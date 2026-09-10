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
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../src/db/index.ts';

const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

async function appliedCount(): Promise<number> {
  try {
    const r = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM drizzle."__drizzle_migrations"`,
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return 0; // table doesn't exist yet on a truly fresh DB
  }
}

async function main() {
  const before = await appliedCount();
  console.log(`[migrate] applying migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  const after = await appliedCount();
  const ran = after - before;
  console.log(ran > 0 ? `[migrate] applied ${ran} new migration(s).` : '[migrate] already up to date.');
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
