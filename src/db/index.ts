import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Whether to negotiate TLS with the database. `DB_SSL=true`/`false` always
// wins when set explicitly. Otherwise: local hosts (localhost/127.0.0.1,
// e.g. a `docker run postgres` or a Cloud SQL Auth Proxy tunnel) default to
// no SSL, since the proxy/local socket already terminates the trust boundary
// and Postgres in Docker doesn't speak TLS out of the box. Any other host
// (a managed provider reachable directly — Cloud SQL public IP, Neon,
// Render, Railway, ...) defaults to SSL with rejectUnauthorized:false,
// matching how these providers commonly present certificates.
function resolveSsl(hostHint: string | undefined): PoolConfig['ssl'] {
  if (process.env.DB_SSL === 'false') return false;
  if (process.env.DB_SSL === 'true') return { rejectUnauthorized: false };
  const isLocalHost = !hostHint || /^(localhost|127\.0\.0\.1|::1)$/i.test(hostHint);
  return isLocalHost ? false : { rejectUnauthorized: false };
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
      max: 10,
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
