// Versioned-migration runner. Replaces the old `drizzle-kit push` that
// docker-entrypoint.sh ran on every container start (which auto-confirmed
// "Yes" to drizzle-kit's prompt — so a change drizzle classified as
// destructive, e.g. a column rename, would silently drop real data). This
// applies the committed, reviewed SQL files in ./drizzle in order, exactly
// once each, tracked in the drizzle.__drizzle_migrations table.
//
// Bundled to dist/migrate.cjs by `npm run build` and invoked by
// docker-entrypoint.sh before the server starts. Locally: `npm run db:migrate`.
//
// Connection + SSL come from src/db/index.ts — the SAME pool config the
// server itself uses — so there is no second, drifting set of DB settings.
import 'dotenv/config';
import path from 'node:path';
import process from 'node:process';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../src/db/index.ts';

const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

async function main() {
  console.log(`[migrate] applying migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  console.log('[migrate] database is up to date.');
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[migrate] FAILED:', err);
    await pool.end().catch(() => {});
    // Non-zero exit stops docker-entrypoint.sh (`set -e`) before the server
    // boots against a half-migrated schema.
    process.exit(1);
  });
