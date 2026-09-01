-- ============================================================================
-- feed-source-attribution.sql — self-service diagnostics for "domain đáng lẽ
-- phải thôi chặn thì lại vẫn bị giữ chặn" (a domain that should have been
-- unblocked when a feed source was paused/deleted stayed 'active').
--
-- Read this first: the AUTHORITATIVE record of "which source(s) currently
-- back this domain+category" is domain_categories.feed_source_id — NOT
-- domains.source (a human-readable text label like "Feed: Hagezi Malware",
-- written ONCE when the domain row is first created and never updated
-- again — see getDomains' own note in src/db/queries.ts). A domain can be
-- independently backed by SEVERAL sources at once since the
-- (domain_id, category_id, feed_source_id) triple-key redesign — pausing
-- source A correctly LEAVES a domain 'active' if any other still-active
-- source (or a manual/no-source entry) also backs it. That is expected,
-- correct behavior, not a bug — these queries help you tell the two apart.
--
-- Run with: psql "$DATABASE_URL" -f feed-source-attribution.sql
-- (or paste each query into psql/pgAdmin individually)
-- ============================================================================

-- Query 1: for every feed source, compare its LIVE ownership (via
-- domain_categories, the real signal) against how many domains still carry
-- its name in the old, frozen domains.source label. A big mismatch here is
-- expected/harmless on its own (many domains legitimately have a DIFFERENT
-- first-writer label while still being live-backed by this source) — this
-- is just to get a feel for the data; Query 2 is what actually explains one
-- specific domain.
SELECT
  fs.id                                                    AS feed_source_id,
  fs.name,
  fs.is_paused,
  fs.domain_count                                          AS domain_count_column,
  count(DISTINCT dc.domain_id)                             AS live_domains_via_domain_categories,
  count(DISTINCT d.id) FILTER (WHERE d.source = 'Feed: ' || fs.name) AS domains_still_labeled_this_source
FROM feed_sources fs
LEFT JOIN domain_categories dc ON dc.feed_source_id = fs.id
LEFT JOIN domains d ON d.id = dc.domain_id
GROUP BY fs.id, fs.name, fs.is_paused, fs.domain_count
ORDER BY fs.name;

-- Query 2: THE useful one when you have a specific domain in hand. Shows
-- every domain_categories row for it — which category, which source (if
-- any), and whether that source is currently paused — plus the domain's
-- current status. Replace 'example.com' below.
--
-- How to read the result:
--   * status = 'active' and every row's feed_source_id is either NULL
--     (manual) or points to a source with is_paused = false -> CORRECT,
--     this domain is genuinely still backed by something active; pausing
--     one paused/deleted source alone was never supposed to unblock it.
--   * status = 'active' but EVERY row's source is paused (or the domain
--     has NO row at all naming the source you actually paused/deleted) ->
--     worth investigating further — this is the shape a real bug (or
--     stale pre-migration data, see below) would take.
SELECT
  d.domain,
  d.status,
  d.unblocked_by_source_pause,
  d.source           AS legacy_source_label,   -- write-once, may be stale
  dc.category_id,
  dc.feed_source_id,
  fs.name            AS feed_source_name,
  fs.is_paused       AS feed_source_is_paused,
  dc.added_at
FROM domains d
JOIN domain_categories dc ON dc.domain_id = d.id
LEFT JOIN feed_sources fs ON fs.id = dc.feed_source_id
WHERE d.domain = 'example.com'  -- <-- thay bằng tên miền cần tra
ORDER BY dc.added_at;

-- Query 3: a domain with NO domain_categories row naming ANY of the sources
-- you'd expect (i.e. Query 2 came back with rows, but none for the source
-- you paused) most likely means that domain's row for that source was
-- SILENTLY OVERWRITTEN before the per-source attribution fix was deployed
-- (commit 393b910) — back when domain_categories was unique on just
-- (domain_id, category_id), a SECOND source syncing the same domain+
-- category overwrote the FIRST source's feed_source_id on that one shared
-- row instead of getting its own row. This query finds domains whose
-- CURRENT single row for a category doesn't match ANY currently-active,
-- non-paused source configured for that same category — a heuristic for
-- "this row's attribution might be stale/wrong", not a guaranteed answer
-- (a domain genuinely dropped by every source pointed at this category is
-- indistinguishable from one with stale attribution by this query alone).
SELECT d.domain, dc.category_id, dc.feed_source_id, d.status, dc.added_at
FROM domain_categories dc
JOIN domains d ON d.id = dc.domain_id
WHERE dc.feed_source_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM feed_sources fs
    WHERE fs.id = dc.feed_source_id AND fs.category = dc.category_id
  )
ORDER BY dc.added_at DESC
LIMIT 200;
