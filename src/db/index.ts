import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Whether (and how) to negotiate TLS with the database.
//
//   DB_SSL=false      → no TLS (the Docker Compose path: app ↔ db over the
//                       private container network, or a local Auth Proxy).
//   DB_SSL=true        → TLS with certificate verification. Trusts the system
//                       CA store, or exactly the PEM at DB_CA_CERT if set
//                       (the right choice for RDS / Cloud SQL / self-managed
//                       Postgres — download the provider's CA bundle).
//   DB_SSL=no-verify   → TLS but accept ANY certificate. Escape hatch for a
//                       provider whose chain can't be verified; offers
//                       encryption but NO man-in-the-middle protection.
//   unset              → local host (localhost/127.0.0.1/::1): no TLS.
//                        any other host: TLS *with verification* (+DB_CA_CERT
//                        if provided). This previously defaulted to
//                        rejectUnauthorized:false — silently accepting any
//                        cert, i.e. no MITM protection (SEC-09).
function resolveSsl(hostHint: string | undefined): PoolConfig['ssl'] {
  const mode = process.env.DB_SSL;
  if (mode === 'false') return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };

  const caPath = process.env.DB_CA_CERT;
  const ca = caPath ? readFileSync(resolve(caPath), 'utf8') : undefined;

  if (mode === 'true') return { rejectUnauthorized: true, ca };

  const isLocalHost = !hostHint || /^(localhost|127\.0\.0\.1|::1)$/i.test(hostHint);
  return isLocalHost ? false : { rejectUnauthorized: true, ca };
}

// Resolve pg Pool connection options from the environment. Two supported
// shapes, checked in this order:
//   1. DATABASE_URL — a single postgres:// connection string (Neon, Render,
//      Railway, Cloud SQL via a proxy exposing a local URL, ...).
//   2. Discrete SQL_HOST / SQL_DB_NAME / SQL_USER / SQL_PASSWORD (+ optional
//      SQL_PORT) — matches .env.example's Cloud SQL naming and avoids
//      URL-encoding pitfalls when a password contains special characters.
// Throws early with an actionable message if neither shape is present,
// instead of letting `pg` fail later with an opaque connection error.
function resolvePoolConfig(): PoolConfig {
  const { DATABASE_URL, SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD, SQL_PORT } = process.env;

  if (DATABASE_URL) {
    let hostHint: string | undefined;
    try {
      hostHint = new URL(DATABASE_URL).hostname;
    } catch {
      // Malformed URL: let `pg` surface the real parse error on connect.
    }
    return { connectionString: DATABASE_URL, ssl: resolveSsl(hostHint) };
  }

  if (SQL_HOST && SQL_DB_NAME && SQL_USER && SQL_PASSWORD) {
    return {
      host: SQL_HOST,
      port: SQL_PORT ? parseInt(SQL_PORT, 10) : 5432,
      database: SQL_DB_NAME,
      user: SQL_USER,
      password: SQL_PASSWORD,
      ssl: resolveSsl(SQL_HOST),
    };
  }

  throw new Error(
    'Missing PostgreSQL connection settings: set DATABASE_URL, or all of ' +
      'SQL_HOST / SQL_DB_NAME / SQL_USER / SQL_PASSWORD, in your environment (see .env.example).'
  );
}

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      ...resolvePoolConfig(),
      // A feed sync holds one connection for its whole (now much shorter,
      // see bulkCreateDomains/addDomainCategoryMemberships chunk sizes)
      // duration — 10 left too little headroom for concurrent Dashboard/
      // Domain Explorer reads from other analysts while a sync is running.
      max: 20,
      connectionTimeoutMillis: 15000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });

// Exported for the one place that needs a raw pg client rather than
// Drizzle's query builder: bulkCreateDomains' COPY-based bulk load (see
// src/db/queries.ts) uses pg-copy-streams, which speaks directly to a
// pg.PoolClient — Drizzle has no equivalent for the COPY wire protocol.
export { pool };
