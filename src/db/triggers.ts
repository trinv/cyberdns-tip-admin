import { sql } from 'drizzle-orm';
import { db } from './index.ts';

// drizzle-kit push only manages tables/columns/indexes declared through the
// schema.ts DSL — it has no concept of functions/triggers, so this raw SQL
// is (re)applied idempotently here at server startup instead, mirroring how
// seedInitialDatabaseIfEmpty() bootstraps data. Safe to run on every start:
// CREATE OR REPLACE FUNCTION/TRIGGER never errors just because it already
// exists, so this call is a no-op after the first successful run.
//
// What this trigger does, on every INSERT/UPDATE/DELETE against
// domain_categories (the authoritative domain↔category membership table,
// see schema.ts — domainId is uniquely constrained there, so a domain has at
// most one row; "moving" it to a different category is an UPDATE of that
// row's category_id, not a new row):
//   1. If an affected domain has no membership currently marked primary,
//      promote its (only) remaining membership.
//   2. Recompute domains.categories (jsonb array) and domains.primaryCategory
//      — the denormalized read-path cache — from the real membership rows.
//   3. Recompute categories.count for whichever category(ies) the change
//      touched (both the old and new category on an UPDATE/move), so
//      category counts shown in the UI are always accurate instead of a
//      stale number frozen at seed time.
//
// STATEMENT-level, not ROW-level: a feed sync can upsert tens or hundreds of
// thousands of membership rows in one statement (see addDomainCategoryMemberships
// in queries.ts, chunked at 1000 rows/statement). A ROW-level trigger — the
// original design — re-runs all of the above (several aggregate queries,
// including a full COUNT(*) over the category) once PER ROW, which is fine
// for a handful of manual edits but turns an N-row bulk insert into
// O(N) separate round-trips of non-trivial queries — this was measured
// taking minutes for ~190k rows. A statement-level trigger with transition
// tables (`REFERENCING NEW TABLE`/`OLD TABLE`) runs the same logic ONCE per
// statement, batched over every row that statement touched, regardless of
// whether that statement affected 1 row or 100,000.
export async function ensureDomainCategoryTriggers() {
  try {
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION sync_domain_category_cache() RETURNS trigger AS $fn$
      DECLARE
        affected_domain_ids integer[];
        affected_category_ids varchar(100)[];
      BEGIN
        IF TG_OP = 'INSERT' THEN
          SELECT array_agg(DISTINCT domain_id), array_agg(DISTINCT category_id)
          INTO affected_domain_ids, affected_category_ids
          FROM new_table;

          -- Step 3 (count), INSERT case: every row in new_table is a net +1
          -- for its category — see the comment above step 3 below for why
          -- this is a delta, not a recount.
          UPDATE categories c
          SET count = count + nc.c
          FROM (SELECT category_id, count(*) AS c FROM new_table GROUP BY category_id) nc
          WHERE c.id = nc.category_id;
        ELSIF TG_OP = 'DELETE' THEN
          SELECT array_agg(DISTINCT domain_id), array_agg(DISTINCT category_id)
          INTO affected_domain_ids, affected_category_ids
          FROM old_table;

          -- Step 3, DELETE case: every row in old_table is a net -1.
          UPDATE categories c
          SET count = count - oc.c
          FROM (SELECT category_id, count(*) AS c FROM old_table GROUP BY category_id) oc
          WHERE c.id = oc.category_id;
        ELSIF TG_OP = 'UPDATE' THEN
          -- A moved membership (domain_id unchanged, category_id changed)
          -- touches both the category it left (old_table) and the one it
          -- joined (new_table).
          SELECT array_agg(DISTINCT domain_id), array_agg(DISTINCT category_id)
          INTO affected_domain_ids, affected_category_ids
          FROM (
            SELECT domain_id, category_id FROM new_table
            UNION
            SELECT domain_id, category_id FROM old_table
          ) both_tables;

          -- Step 3, UPDATE case: per category, net change = (rows that
          -- moved IN, from new_table) minus (rows that moved OUT, from
          -- old_table) — zero for a category whose rows only had
          -- sourceLabel/feedSourceId change (same category_id in both
          -- tables, so it cancels out to a 0 delta and touches no row here).
          UPDATE categories c
          SET count = count + deltas.delta
          FROM (
            SELECT COALESCE(n.category_id, o.category_id) AS category_id,
                   COALESCE(n.c, 0) - COALESCE(o.c, 0) AS delta
            FROM (SELECT category_id, count(*) AS c FROM new_table GROUP BY category_id) n
            FULL OUTER JOIN (SELECT category_id, count(*) AS c FROM old_table GROUP BY category_id) o
              ON n.category_id = o.category_id
          ) deltas
          WHERE c.id = deltas.category_id AND deltas.delta <> 0;
        END IF;

        IF affected_domain_ids IS NULL THEN
          RETURN NULL;
        END IF;

        -- 1. Fallback-promote a primary membership for every affected domain
        --    that currently has none — one batched UPDATE, not one per domain.
        WITH oldest AS (
          SELECT DISTINCT ON (domain_id) id, domain_id
          FROM domain_categories
          WHERE domain_id = ANY(affected_domain_ids)
          ORDER BY domain_id, added_at ASC, id ASC
        )
        UPDATE domain_categories dc
        SET is_primary = true
        FROM oldest
        WHERE dc.id = oldest.id
          AND NOT EXISTS (
            SELECT 1 FROM domain_categories dc2
            WHERE dc2.domain_id = dc.domain_id AND dc2.is_primary = true
          );

        -- 2. Recompute the denormalized cache on domains for every affected
        --    domain in ONE statement.
        WITH agg AS (
          SELECT dc.domain_id,
                 jsonb_agg(dc.category_id ORDER BY dc.added_at ASC) AS cats,
                 (array_agg(dc.category_id) FILTER (WHERE dc.is_primary))[1] AS primary_cat
          FROM domain_categories dc
          WHERE dc.domain_id = ANY(affected_domain_ids)
          GROUP BY dc.domain_id
        )
        UPDATE domains d
        SET
          categories = COALESCE(agg.cats, '[]'::jsonb),
          primary_category = agg.primary_cat,
          updated_at = now()
        FROM (SELECT unnest(affected_domain_ids) AS id) ids
        LEFT JOIN agg ON agg.domain_id = ids.id
        WHERE d.id = ids.id;

        -- 3. Every affected category's live count is maintained INCREMENTALLY
        --    above (inside each TG_OP branch), as a delta from just this
        --    statement's transition table(s) — NOT by recomputing
        --    SELECT count(*) FROM domain_categories WHERE category_id = c.id
        --    (the original design). That recount was the real scaling bug: its
        --    cost is proportional to the category's CURRENT total size, not to
        --    how many rows this statement touched — so as a category
        --    accumulates rows across repeated feed syncs over time, every
        --    single later sync's checkpoint-triggering write burst gets
        --    progressively more expensive purely from that one category
        --    having grown, even though the actual work done per sync
        --    (rows inserted) didn't change. An incremental delta costs the
        --    same regardless of how large the category has already grown.
        --    Safe because domain_categories has exactly one writer — this
        --    trigger's own statement — so count can never drift out of sync
        --    with reality (see the file-level comment: "the ONLY places that
        --    should touch domain_categories").

        RETURN NULL;
      END;
      $fn$ LANGUAGE plpgsql;
    `);

    // Three separate statement-level triggers (one per event) rather than one
    // combined trigger: each only declares the transition table(s) that are
    // actually meaningful for its event (INSERT only ever has new_table,
    // DELETE only ever has old_table, UPDATE has both), which keeps the
    // REFERENCING clauses unambiguous.
    await db.execute(sql`
      CREATE OR REPLACE TRIGGER trg_sync_domain_category_cache_ins
      AFTER INSERT ON domain_categories
      REFERENCING NEW TABLE AS new_table
      FOR EACH STATEMENT EXECUTE FUNCTION sync_domain_category_cache();
    `);
    await db.execute(sql`
      CREATE OR REPLACE TRIGGER trg_sync_domain_category_cache_upd
      AFTER UPDATE ON domain_categories
      REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
      FOR EACH STATEMENT EXECUTE FUNCTION sync_domain_category_cache();
    `);
    await db.execute(sql`
      CREATE OR REPLACE TRIGGER trg_sync_domain_category_cache_del
      AFTER DELETE ON domain_categories
      REFERENCING OLD TABLE AS old_table
      FOR EACH STATEMENT EXECUTE FUNCTION sync_domain_category_cache();
    `);

    // Drop the old row-level trigger from earlier versions of this schema,
    // if present — CREATE OR REPLACE TRIGGER above only replaces a trigger
    // of the same name, and this one has been superseded (renamed into the
    // three above), so it would otherwise keep firing redundantly alongside them.
    await db.execute(sql`DROP TRIGGER IF EXISTS trg_sync_domain_category_cache ON domain_categories;`);
  } catch (error) {
    console.error('Failed to install domain_categories sync trigger:', error);
    throw error;
  }
}

// Two indexes drizzle-kit's schema.ts DSL can't express (a trigram GIN
// index needs the pg_trgm extension + a non-default operator class; a
// partial index needs a WHERE clause) — applied idempotently at startup the
// same way as the trigger above, instead of living in schema.ts.
//
// 1. domains_domain_trgm_idx: getDomains' search filter is
//    `ilike(domains.domain, '%term%')` — a LEADING wildcard, which a normal
//    btree index (like the one domains.domain already has from its UNIQUE
//    constraint) cannot use at all; Postgres falls back to scanning every
//    row. A trigram GIN index is what makes a leading-wildcard ILIKE
//    index-backed instead.
// 2. domains_active_threat_idx: backs getDashboardStats' "recentHighThreat"
//    query (`WHERE status='active' ORDER BY threat_score DESC, last_seen
//    DESC LIMIT 6`) — a partial index (only 'active' rows, which is also
//    the only status this query ever filters on) pre-sorted in exactly the
//    order that query needs, so it's a direct index scan + LIMIT instead of
//    sorting every active domain on each dashboard load.
export async function ensureSearchIndexes() {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domains_domain_trgm_idx
      ON domains USING gin (domain gin_trgm_ops);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domains_active_threat_idx
      ON domains (threat_score DESC, last_seen DESC)
      WHERE status = 'active';
    `);
  } catch (error) {
    console.error('Failed to install search/dashboard indexes:', error);
    throw error;
  }
}
