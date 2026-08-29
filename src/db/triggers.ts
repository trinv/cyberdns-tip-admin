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
// domain_categories (the authoritative domain↔category membership table —
// see schema.ts: a domain can have several rows for the SAME category_id
// now, one per distinct feedSourceId, so counting/aggregating below always
// dedupes by (domain_id, category_id) rather than counting raw rows):
//   1. If an affected domain has no membership currently marked primary,
//      promote its oldest remaining membership.
//   2. Recompute domains.categories (jsonb array, each category_id listed
//      ONCE regardless of how many sources back it) and
//      domains.primaryCategory — the denormalized read-path cache — from
//      the real membership rows.
//   3. Recompute categories.count for whichever category(ies) the change
//      touched — counting DISTINCT DOMAINS per category, not membership
//      rows, since one domain can now hold multiple rows in the same
//      category (see above) that must only count once.
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
    // The real (domain_id, category_id, feed_source_id) uniqueness — see
    // schema.ts's file-level note on domain_categories for why this needs
    // NULLS NOT DISTINCT (so multiple manual/null-source entries for the
    // same domain+category still collapse into one row) and why it's raw
    // SQL here rather than declared in schema.ts (not expressible through
    // that DSL). Superseded the old 2-column (domain_id, category_id)
    // unique index, which schema.ts no longer declares — drizzle-kit push
    // drops that one on its own; this just needs to exist before the
    // ON CONFLICT targets in queries.ts that rely on it.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS domain_categories_domain_category_source_uidx
      ON domain_categories (domain_id, category_id, feed_source_id) NULLS NOT DISTINCT;
    `);

    await db.execute(sql`
      CREATE OR REPLACE FUNCTION sync_domain_category_cache() RETURNS trigger AS $fn$
      DECLARE
        affected_domain_ids integer[];
      BEGIN
        IF TG_OP = 'INSERT' THEN
          SELECT array_agg(DISTINCT domain_id) INTO affected_domain_ids FROM new_table;

          -- Step 3 (count), INSERT case: a category's count only grows when
          -- a domain becomes NEWLY represented in it — not once per row,
          -- since a second source adding a domain the category ALREADY has
          -- (via a different source's earlier row) must NOT double-count
          -- it. For each distinct (domain_id, category_id) this statement
          -- touched, an indexed point-lookup (bounded by THIS statement's
          -- size via domain_categories_domain_category_source_uidx, not the
          -- category's total size — preserving the delta approach's whole
          -- point) checks whether any OTHER row for that same pair already
          -- existed before this statement.
          UPDATE categories c
          SET count = count + nc.c
          FROM (
            SELECT nt.category_id, count(*) AS c
            FROM (SELECT DISTINCT domain_id, category_id FROM new_table) nt
            WHERE NOT EXISTS (
              SELECT 1 FROM domain_categories dc
              WHERE dc.domain_id = nt.domain_id
                AND dc.category_id = nt.category_id
                AND NOT EXISTS (SELECT 1 FROM new_table nt2 WHERE nt2.id = dc.id)
            )
            GROUP BY nt.category_id
          ) nc
          WHERE c.id = nc.category_id;
        ELSIF TG_OP = 'DELETE' THEN
          SELECT array_agg(DISTINCT domain_id) INTO affected_domain_ids FROM old_table;

          -- Step 3, DELETE case: a category's count only drops when a
          -- domain has NO remaining row left in it — not once per row
          -- removed, since deleting just one of two sources backing the
          -- same domain+category must NOT decrement (the domain is still
          -- represented via the other source's row). By the time an AFTER
          -- DELETE trigger runs, old_table's rows are already gone from the
          -- real table, so this is a direct existence check, no exclusion
          -- needed (unlike the INSERT branch above).
          UPDATE categories c
          SET count = count - oc.c
          FROM (
            SELECT ot.category_id, count(*) AS c
            FROM (SELECT DISTINCT domain_id, category_id FROM old_table) ot
            WHERE NOT EXISTS (
              SELECT 1 FROM domain_categories dc
              WHERE dc.domain_id = ot.domain_id AND dc.category_id = ot.category_id
            )
            GROUP BY ot.category_id
          ) oc
          WHERE c.id = oc.category_id;
        ELSIF TG_OP = 'UPDATE' THEN
          -- category_id is part of the unique key now (see schema.ts), so
          -- it never actually changes value in an UPDATE anymore — only
          -- source_label/feed_source_id can (see addDomainCategoryMemberships'
          -- onConflictDoUpdate in queries.ts). That means new_table and
          -- old_table always agree on (domain_id, category_id) counts per
          -- category here, so this branch's own delta always nets to zero —
          -- kept only as a defensive no-op in case anything ever DOES
          -- change category_id via a genuine UPDATE again.
          SELECT array_agg(DISTINCT domain_id)
          INTO affected_domain_ids
          FROM (
            SELECT domain_id FROM new_table
            UNION
            SELECT domain_id FROM old_table
          ) both_tables;

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
        --    that currently has none — one batched UPDATE, not one per
        --    domain. Picks the domain's globally-oldest row regardless of
        --    how many rows share its category_id with other sources; which
        --    specific row of a shared category gets the flag doesn't
        --    matter, since step 2 below only reads its category_id, and
        --    that's the same value on every row for that category anyway.
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
        --    domain in ONE statement. cats_agg and primary_agg are built
        --    SEPARATELY (not one CTE joining domain_categories back in) —
        --    joining cat_first_seen (already deduped to one row per
        --    domain_id+category_id) back onto the raw domain_categories
        --    table to pick up is_primary would fan back OUT to however many
        --    source-rows share that category, making jsonb_agg count the
        --    same category_id once per source instead of once per domain —
        --    exactly the duplicate-badge bug a domain backed by two sources
        --    for the same category would otherwise hit.
        WITH cat_first_seen AS (
          SELECT domain_id, category_id, min(added_at) AS first_added
          FROM domain_categories
          WHERE domain_id = ANY(affected_domain_ids)
          GROUP BY domain_id, category_id
        ),
        cats_agg AS (
          SELECT domain_id, jsonb_agg(category_id ORDER BY first_added ASC) AS cats
          FROM cat_first_seen
          GROUP BY domain_id
        ),
        primary_agg AS (
          -- At most one row per domain_id by construction (step 1 above
          -- ensures exactly one row is ever flagged primary per domain,
          -- regardless of how many rows share its category_id) — a plain
          -- lookup, no fan-out risk.
          SELECT domain_id, category_id AS primary_cat
          FROM domain_categories
          WHERE domain_id = ANY(affected_domain_ids) AND is_primary = true
        )
        UPDATE domains d
        SET
          categories = COALESCE(cats_agg.cats, '[]'::jsonb),
          primary_category = primary_agg.primary_cat,
          updated_at = now()
        FROM (SELECT unnest(affected_domain_ids) AS id) ids
        LEFT JOIN cats_agg ON cats_agg.domain_id = ids.id
        LEFT JOIN primary_agg ON primary_agg.domain_id = ids.id
        WHERE d.id = ids.id;

        -- 3. Every affected category's live count is maintained INCREMENTALLY
        --    above (inside each TG_OP branch), as a delta from just this
        --    statement's transition table(s) — NOT by recomputing
        --    SELECT count(DISTINCT domain_id) FROM domain_categories WHERE
        --    category_id = c.id (a correct but O(category size) recount).
        --    That recount was the real scaling bug this design avoids: its
        --    cost is proportional to the category's CURRENT total size, not
        --    to how many rows this statement touched — so as a category
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

// A trigram GIN index drizzle-kit's schema.ts DSL can't express (needs the
// pg_trgm extension + a non-default operator class) — applied idempotently
// at startup the same way as the trigger above, instead of living in
// schema.ts.
//
// domains_domain_trgm_idx: getDomains' search filter is
// `ilike(domains.domain, '%term%')` — a LEADING wildcard, which a normal
// btree index (like the one domains.domain already has from its UNIQUE
// constraint) cannot use at all; Postgres falls back to scanning every row.
// A trigram GIN index is what makes a leading-wildcard ILIKE index-backed
// instead.
export async function ensureSearchIndexes() {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domains_domain_trgm_idx
      ON domains USING gin (domain gin_trgm_ops);
    `);
    // domains_categories_gin_idx: a domain can belong to several categories
    // (see schema.ts's note on domain_categories' composite unique
    // constraint), so getDomains' category filter checks jsonb containment
    // (`categories @> '["id"]'`) against the whole array instead of equality
    // against primaryCategory. jsonb's default GIN opclass already supports
    // `@>` directly — no non-default opclass needed here, unlike the trigram
    // index above — but it's still not expressible via schema.ts's DSL, so
    // it's applied idempotently here the same way.
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS domains_categories_gin_idx
      ON domains USING gin (categories);
    `);
    // Cleanup: an earlier version of this function created a partial index
    // sorted by threat_score, which no longer exists as a column (removed —
    // it was never backed by a real scoring pipeline, see schema.ts).
    // domains_status_idx + domains_last_seen_idx together already cover the
    // dashboard's "recent active domains" query well enough that a
    // dedicated composite/partial index isn't worth the extra write cost.
    await db.execute(sql`DROP INDEX IF EXISTS domains_active_threat_idx;`);
  } catch (error) {
    console.error('Failed to install search/dashboard indexes:', error);
    throw error;
  }
}
