// ONE-TIME, existing-database-only. Run this exactly once, against the
// production database that already has its tables (built up over time by the
// old `drizzle-kit push` on every boot), at the moment you switch to
// versioned migrations.
//
// It records every migration currently in ./drizzle as "already applied"
// WITHOUT executing any of their SQL, so the first real `npm run db:migrate`
// does not try to CREATE TABLE on tables that already exist. After this,
// only NEW migration files run.
//
// A FRESH database must NOT run this — it should just run `npm run db:migrate`,
// which will create everything from 0000_baseline_schema.sql.
//
// Usage (from the repo root, with the prod DB reachable):
//   DATABASE_URL='postgres://…' DB_SSL=true node scripts/baseline-existing-db.mjs
import 'dotenv/config';
import path from 'node:path';
import process from 'node:process';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Pool } from 'pg';

function resolvePool() {
  const connectionString = process.env.DATABASE_URL;
  const discrete =
    process.env.SQL_HOST && process.env.SQL_DB_NAME && process.env.SQL_USER && process.env.SQL_PASSWORD;
  if (!connectionString && !discrete) {
    throw new Error('Set DATABASE_URL, or all of SQL_HOST / SQL_DB_NAME / SQL_USER / SQL_PASSWORD.');
  }
  const ssl =
    process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
  return new Pool(
    connectionString
      ? { connectionString, ssl }
      : {
          host: process.env.SQL_HOST,
          port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
          database: process.env.SQL_DB_NAME,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          ssl,
        }
  );
}

async function main() {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0) {
    throw new Error(`No migrations found in ${migrationsFolder} — run \`npm run db:generate\` first.`);
  }

  const pool = resolvePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await client.query(
      'CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)'
    );

    const { rows } = await client.query('SELECT count(*)::int AS n FROM drizzle."__drizzle_migrations"');
    if (rows[0].n > 0) {
      console.log(`drizzle.__drizzle_migrations already has ${rows[0].n} row(s) — nothing to baseline. Aborting.`);
      await client.query('ROLLBACK');
      return;
    }

    // Sanity check: this really is the expected pre-migration schema.
    const { rows: tbl } = await client.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'domains'"
    );
    if (tbl[0].n === 0) {
      await client.query('ROLLBACK');
      throw new Error(
        'No `public.domains` table found — this looks like a FRESH database. Do NOT baseline it; run `npm run db:migrate` instead.'
      );
    }

    for (const m of migrations) {
      await client.query('INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)', [
        m.hash,
        m.folderMillis,
      ]);
      console.log(`marked applied: hash=${m.hash.slice(0, 12)}… when=${m.folderMillis}`);
    }
    await client.query('COMMIT');
    console.log(`\nDone — ${migrations.length} migration(s) marked as already applied.`);
    console.log('Future deploys: `dist/migrate.cjs` on boot will run only NEW files.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Baseline FAILED:', err.message ?? err);
  process.exit(1);
});
