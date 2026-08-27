-- ============================================================================
-- schema.sql — the exact subset of CyberDNS TIP's production schema that
-- sync_domains.py reads from or writes to: `categories`, `domains`,
-- `domain_categories`, `feed_sources`, and the trigger that keeps
-- domains.categories/primary_category and categories.count in sync.
--
-- Column-for-column, this mirrors src/db/schema.ts (the Node app's
-- Drizzle schema) and the trigger mirrors src/db/triggers.ts verbatim —
-- NOT a simplified substitute. Everything below uses IF NOT EXISTS /
-- CREATE OR REPLACE, so:
--
--   * Against a real CyberDNS TIP database (already provisioned by the
--     app's own `npm run db:push` + startup trigger install): running this
--     file is a safe, idempotent no-op — nothing here will conflict with
--     or duplicate what's already there.
--   * Against a fresh/empty database (e.g. to run or test this tool
--     standalone, without the Node app): this file alone provisions
--     everything sync_domains.py needs.
--
-- What's deliberately NOT here: users/sessions/login_logs/releases/
-- review_queue/audit_logs/saved_filters — the rest of the app's schema
-- that this bulk-sync tool never reads or writes.
-- ============================================================================

-- 1. Categories — domain_categories.category_id references this.
CREATE TABLE IF NOT EXISTS categories (
    id               VARCHAR(100) PRIMARY KEY,
    name             TEXT NOT NULL,
    description      TEXT,
    count            INTEGER NOT NULL DEFAULT 0,
    color            VARCHAR(20) NOT NULL DEFAULT '#10B981',
    border_color     VARCHAR(50) NOT NULL DEFAULT 'border-emerald-500/30',
    badge_bg         VARCHAR(50) NOT NULL DEFAULT 'bg-emerald-500/10',
    badge_text       VARCHAR(50) NOT NULL DEFAULT 'text-emerald-500',
    delta_threshold  INTEGER NOT NULL DEFAULT 3,
    created_at       TIMESTAMP NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP NOT NULL DEFAULT now()
);

-- 2. Feed sources — domain_categories.feed_source_id optionally references
-- this (nullable: manual entries and this tool's own runs, unless
-- --feed-source-id is passed, have none). Only the columns needed to
-- satisfy the FK + NOT NULL constraints are listed with real defaults;
-- see src/db/schema.ts for the full column set (sync progress/phase, etc.
-- — irrelevant to this tool, which never touches feed_sources).
CREATE TABLE IF NOT EXISTS feed_sources (
    id             VARCHAR(100) PRIMARY KEY,
    name           TEXT NOT NULL,
    url            TEXT NOT NULL,
    category       VARCHAR(100) NOT NULL,
    domain_count   INTEGER NOT NULL DEFAULT 0,
    last_sync      TIMESTAMP,
    sync_interval  VARCHAR(50) NOT NULL DEFAULT '1 giờ',
    status         VARCHAR(50) NOT NULL DEFAULT 'idle',
    sync_progress  INTEGER NOT NULL DEFAULT 0,
    sync_phase     TEXT,
    is_paused      BOOLEAN NOT NULL DEFAULT false,
    color          VARCHAR(20) NOT NULL DEFAULT '#10B981',
    removed_today  INTEGER NOT NULL DEFAULT 0,
    error_message  TEXT,
    last_sync_message TEXT,
    is_custom      BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMP NOT NULL DEFAULT now(),
    updated_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- 3. Domains — the core inventory. `categories` (jsonb) and
-- `primary_category` are a DENORMALIZED READ-PATH CACHE, not the source of
-- truth (see the trigger below) — sync_domains.py never writes either
-- column directly, and neither should anything else.
CREATE TABLE IF NOT EXISTS domains (
    id                       SERIAL PRIMARY KEY,
    domain                   TEXT NOT NULL UNIQUE,
    etld1                    TEXT NOT NULL,
    tld                      VARCHAR(50) NOT NULL,
    categories               JSONB NOT NULL DEFAULT '[]',
    primary_category         VARCHAR(100),
    source                   TEXT NOT NULL,
    source_detail            TEXT,
    status                   VARCHAR(50) NOT NULL DEFAULT 'active',
    unblocked_by_source_pause BOOLEAN NOT NULL DEFAULT false,
    first_seen               TIMESTAMP NOT NULL DEFAULT now(),
    last_seen                TIMESTAMP NOT NULL DEFAULT now(),
    is_protected              BOOLEAN NOT NULL DEFAULT false,
    timeline                 JSONB NOT NULL DEFAULT '[]',
    tags                     JSONB NOT NULL DEFAULT '[]',
    created_at               TIMESTAMP NOT NULL DEFAULT now(),
    updated_at               TIMESTAMP NOT NULL DEFAULT now()
);
-- No separate index on `domain` beyond the UNIQUE constraint above — it
-- already backs one; a second explicit index on the same column would be
-- pure write-overhead for zero read benefit (see schema.ts's own note).
CREATE INDEX IF NOT EXISTS domains_status_idx ON domains (status);
CREATE INDEX IF NOT EXISTS domains_primary_category_idx ON domains (primary_category);
CREATE INDEX IF NOT EXISTS domains_tld_idx ON domains (tld);
CREATE INDEX IF NOT EXISTS domains_last_seen_idx ON domains (last_seen);

-- 4. Domain <-> Category membership — the AUTHORITATIVE relation.
-- domain_id is uniquely constrained: a domain belongs to exactly ONE
-- category at a time, atomically, even under concurrent syncs — re-adding
-- a domain under a different category is an UPDATE (a move), never a
-- second row. This is what upsert_memberships()'s
-- "ON CONFLICT (domain_id) DO UPDATE" in sync_domains.py relies on.
CREATE TABLE IF NOT EXISTS domain_categories (
    id             SERIAL PRIMARY KEY,
    domain_id      INTEGER NOT NULL UNIQUE
                       REFERENCES domains (id) ON DELETE CASCADE,
    category_id    VARCHAR(100) NOT NULL
                       REFERENCES categories (id) ON DELETE RESTRICT,
    feed_source_id VARCHAR(100)
                       REFERENCES feed_sources (id) ON DELETE SET NULL,
    source_label   TEXT,
    is_primary     BOOLEAN NOT NULL DEFAULT false,
    added_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domain_categories_category_idx ON domain_categories (category_id);
CREATE INDEX IF NOT EXISTS domain_categories_feed_source_idx ON domain_categories (feed_source_id);

-- ============================================================================
-- 5. Trigger: keeps domains.categories/primary_category and
-- categories.count derived from domain_categories automatically, on every
-- INSERT/UPDATE/DELETE against it — including the two upserts
-- sync_domains.py issues. Copied verbatim from src/db/triggers.ts
-- (ensureDomainCategoryTriggers) — the SAME trigger the production app
-- installs at startup, not a reimplementation, so behavior can't drift
-- between "how the app does it" and "how this tool does it".
--
-- STATEMENT-level (not ROW-level): a bulk sync upserts tens or hundreds of
-- thousands of membership rows in one statement — a ROW-level trigger
-- would re-run all of this (several aggregate queries each) once PER ROW,
-- turning an N-row bulk upsert into O(N) separate non-trivial round-trips.
-- This runs the same logic ONCE per statement, over every row that
-- statement touched, regardless of whether that was 1 row or 500,000.
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_domain_category_cache() RETURNS trigger AS $fn$
DECLARE
    affected_domain_ids integer[];
    affected_category_ids varchar(100)[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT array_agg(DISTINCT domain_id), array_agg(DISTINCT category_id)
        INTO affected_domain_ids, affected_category_ids
        FROM new_table;

        UPDATE categories c
        SET count = count + nc.c
        FROM (SELECT category_id, count(*) AS c FROM new_table GROUP BY category_id) nc
        WHERE c.id = nc.category_id;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT array_agg(DISTINCT domain_id), array_agg(DISTINCT category_id)
        INTO affected_domain_ids, affected_category_ids
        FROM old_table;

        UPDATE categories c
        SET count = count - oc.c
        FROM (SELECT category_id, count(*) AS c FROM old_table GROUP BY category_id) oc
        WHERE c.id = oc.category_id;
    ELSIF TG_OP = 'UPDATE' THEN
        SELECT array_agg(DISTINCT domain_id), array_agg(DISTINCT category_id)
        INTO affected_domain_ids, affected_category_ids
        FROM (
            SELECT domain_id, category_id FROM new_table
            UNION
            SELECT domain_id, category_id FROM old_table
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

    -- 3. categories.count is maintained incrementally above (inside each
    --    TG_OP branch), as a delta from just this statement's transition
    --    table(s) — not by a full recount, which would cost more with
    --    every sync as a category accumulates rows over time. Safe because
    --    domain_categories has exactly one writer (this trigger's own
    --    statement), so count can never drift out of sync with reality.

    RETURN NULL;
END;
$fn$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_sync_domain_category_cache_ins
AFTER INSERT ON domain_categories
REFERENCING NEW TABLE AS new_table
FOR EACH STATEMENT EXECUTE FUNCTION sync_domain_category_cache();

CREATE OR REPLACE TRIGGER trg_sync_domain_category_cache_upd
AFTER UPDATE ON domain_categories
REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
FOR EACH STATEMENT EXECUTE FUNCTION sync_domain_category_cache();

CREATE OR REPLACE TRIGGER trg_sync_domain_category_cache_del
AFTER DELETE ON domain_categories
REFERENCING OLD TABLE AS old_table
FOR EACH STATEMENT EXECUTE FUNCTION sync_domain_category_cache();

-- ----------------------------------------------------------------------------
-- Reference only — sync_domains.py creates/truncates this itself every run,
-- you don't need to run this block by hand.
-- ----------------------------------------------------------------------------
-- UNLOGGED skips WAL (write-ahead log) writes entirely, and it's
-- unindexed — the two things that make per-row inserts slow at scale.
-- Safe specifically because its content is fully disposable: it exists
-- only to stage one run's input and gets TRUNCATEd at the end of every
-- run, so losing it to a crash costs nothing — just re-run the sync.
--
-- CREATE UNLOGGED TABLE IF NOT EXISTS tmp_domains (domain text);
