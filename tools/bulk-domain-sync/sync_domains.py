#!/usr/bin/env python3
"""
sync_domains.py — bulk-sync a raw domain blocklist feed into PostgreSQL,
matching CyberDNS TIP's actual production schema (src/db/schema.ts) exactly
— not a simplified standalone table. See README.md's "Why this shape" for
the full walkthrough of how this maps onto that schema.

The production `domains` table is denormalized: `domains.categories`
(jsonb array) and `domains.primary_category` are a READ-PATH CACHE derived
from the real source of truth, `domain_categories` (one row per domain,
its `domain_id` uniquely constrained — a domain belongs to exactly one
category at a time). A Postgres trigger on `domain_categories`
(sync_domain_category_cache, see src/db/triggers.ts) keeps that cache and
`categories.count` in sync automatically on every insert/update/delete —
this script must NEVER write domains.categories/primary_category directly,
only domain_categories, exactly like the real app's own
createDomain/bulkCreateDomains + addDomainCategoryMemberships do.

Pipeline:

  1. Read the raw feed and clean each line (AdBlock "||domain.com^" rules,
     hosts-file "0.0.0.0 domain.com" lines, or plain "domain.com" — all in
     one file is fine) into a bare domain. Pure Python — no DB round-trips.
  2. Deduplicate in memory with a set(). One clean, deduplicated list
     BEFORE anything touches the database.
  3. COPY that list into an UNLOGGED staging table (tmp_domains, one
     column: domain) — the real COPY wire protocol via psycopg2's
     copy_expert, not one INSERT per row and not even execute_values
     (which is still N row-inserts under the hood, just batched).
  4. Phase A — upsert into `domains`: one set-based
     INSERT ... SELECT ... ON CONFLICT (domain) DO UPDATE, computing
     etld1/tld in SQL from the staged domain. Matches the real app's
     bulkCreateDomains onConflict behavior exactly: an existing domain is
     reset to status='active' (a feed re-listing it always means "still
     blocked", overriding e.g. a stale 'unblocked'), first_seen/timeline
     are left untouched (no explicit SET — only apply on true INSERT via
     column defaults).
  5. Phase B — upsert into `domain_categories`, joining the staging table
     to `domains` on domain name for the id (no Python-side id bookkeeping
     needed): one INSERT ... SELECT ... ON CONFLICT (domain_id) DO UPDATE,
     matching addDomainCategoryMemberships' onConflictDoUpdate exactly
     (moves an existing domain to this category rather than erroring).
     The trigger then derives domains.categories/primary_category and
     categories.count from this — this script touches neither directly.
  6. TRUNCATE the staging table so the next run starts from empty.

Both phases run in ONE transaction — if Phase B fails, Phase A's writes
roll back too, so a run never leaves domains inserted but uncategorized.

Usage:
    export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
    python sync_domains.py --input blocklist.txt --category malware \
        [--source "Feed: MyFeed"] [--source-label "myfeed/list"] \
        [--feed-source-id hagezi-malware]

Requires: psycopg2-binary (see requirements.txt); the production schema
(domains, categories, domain_categories, feed_sources) and its trigger
already applied — i.e. the main app's `npm run db:push` /
ensureDomainCategoryTriggers() has run at least once against this
database. `--category` must already exist in `categories` (this script
validates that up front and fails fast with a clear message otherwise,
matching the FK-violation-translation the app itself does — see
addDomainCategoryMemberships in src/db/queries.ts).

Out of scope (by design): this script does NOT touch the `feed_sources`
table's own bookkeeping (domain_count/last_sync/status/progress) — that's
per-source sync-job orchestration, not part of "bulk-write a domain list
into Postgres". Pass --feed-source-id purely for domain_categories'
provenance tracking (nullable, exactly like a manual entry has none) if
this run corresponds to a real row there.
"""

from __future__ import annotations

import argparse
import csv
import io
import logging
import os
import re
import sys
import time
from typing import Iterable

import psycopg2

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("domain-sync")


# ---------------------------------------------------------------------------
# Step 1 + 2: parse, clean, deduplicate — entirely off the database.
# ---------------------------------------------------------------------------

# A conservative but real domain-name shape: labels of letters/digits/
# hyphens (never starting/ending with '-'), at least one dot. Deliberately
# strict rather than "anything with a dot in it" — a malformed line
# silently becoming a garbage row in a threat-intel table is worse than
# dropping it.
_DOMAIN_RE = re.compile(
    r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$"
)
# A bare IPv4 octet group (e.g. hosts-file noise like "0.0.0.0 0.0.0.0") is
# character-class-compatible with _DOMAIN_RE (digits are valid label
# chars) but is never a real domain — reject it explicitly.
_IPV4_RE = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
# "||domain.com^" or "||domain.com^$third-party,other-option" — captures
# just the domain. The character class excludes "/" and "*" so a path- or
# wildcard-path AdBlock rule (not a plain domain block) falls through to,
# and gets rejected by, the generic branch below instead of mis-parsing.
_ADBLOCK_RE = re.compile(r"^\|\|([a-z0-9.-]+)\^")
_HOSTS_PREFIX_RE = re.compile(r"^(?:0\.0\.0\.0|127\.0\.0\.1|::1?)\s+")


def clean_line(raw: str) -> str | None:
    """Extract a bare domain from one raw feed line, or None if the line
    isn't a plain domain-block rule (comment, cosmetic filter, an AdBlock
    *exception* rule, a path/wildcard rule, malformed, etc.)."""
    line = raw.strip()
    if not line or line.startswith(("#", "!", ";", "[")):
        return None
    if line.startswith("@@"):  # AdBlock EXCEPTION rule — the opposite of a block
        return None
    if "##" in line or "#@#" in line:  # cosmetic filter, not a domain block
        return None

    match = _ADBLOCK_RE.match(line)
    if match:
        domain = match.group(1)
    else:
        domain = _HOSTS_PREFIX_RE.sub("", line)
        domain = domain.split("#", 1)[0].strip()  # trailing inline comment
        if not domain:
            return None
        domain = re.sub(r"^https?://", "", domain, flags=re.IGNORECASE)
        domain = domain.split("/", 1)[0].split("?", 1)[0].split(":", 1)[0]
        domain = re.sub(r"^\*\.", "", domain)  # leading wildcard label

    domain = domain.lower().strip()
    if not domain or not _DOMAIN_RE.match(domain) or _IPV4_RE.match(domain):
        return None
    return domain


def load_and_clean(path: str) -> set[str]:
    """Read the raw file and return a deduplicated set of clean domains.

    Dedup happens HERE, in RAM, before the database is ever touched — the
    same effect as piping the cleaned output through `sort -u` on the
    shell (see clean_dedupe.sh for that variant), just done in-process so
    there's one artifact (this script) to run instead of a shell pipeline
    plus a script.
    """
    seen: set[str] = set()
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for raw_line in f:
            domain = clean_line(raw_line)
            if domain:
                seen.add(domain)
    return seen


# ---------------------------------------------------------------------------
# Steps 3-6: stage via COPY, upsert domains, upsert domain_categories, truncate.
# ---------------------------------------------------------------------------

CREATE_STAGING_SQL = """
CREATE UNLOGGED TABLE IF NOT EXISTS tmp_domains (
    domain text
);
"""

# etld1/tld are derived here in SQL from the staged domain, using the SAME
# simplistic heuristic the real app uses (src/db/queries.ts
# createDomain/bulkCreateDomains: last label = tld, second-to-last + tld =
# etld1) rather than a true public-suffix-list lookup — matching existing
# production behavior exactly, not "fixing" it here.
#
# ON CONFLICT (domain) DO UPDATE mirrors bulkCreateDomains' onConflictDoUpdate
# exactly: an existing domain is reset to status='active' (a feed re-listing
# it always means "still blocked" — this deliberately overrides e.g. a
# stale 'unblocked'). first_seen/timeline are NOT in the SET clause, so an
# existing row keeps its original first_seen — they only take their column
# DEFAULT on a true INSERT.
UPSERT_DOMAINS_SQL = """
INSERT INTO domains (domain, etld1, tld, source, source_detail, status)
SELECT
    t.domain,
    CASE WHEN array_length(parts, 1) > 2
         THEN parts[array_length(parts, 1) - 1] || '.' || parts[array_length(parts, 1)]
         ELSE t.domain
    END,
    parts[array_length(parts, 1)],
    %(source)s,
    %(source_detail)s,
    'active'
FROM (
    SELECT domain, string_to_array(domain, '.') AS parts FROM tmp_domains
) t
ON CONFLICT (domain) DO UPDATE SET
    status = 'active',
    updated_at = now();
"""

# Joins staging -> domains on the domain NAME to get domain_id — no Python-
# side id bookkeeping between phases needed, this is one set-based
# statement regardless of batch size. ON CONFLICT (domain_id) DO UPDATE
# mirrors addDomainCategoryMemberships' onConflictDoUpdate exactly: since
# domain_id is uniquely constrained (a domain belongs to exactly ONE
# category at a time), re-syncing a domain already in a DIFFERENT category
# MOVES it here rather than erroring — there is no separate "remove from
# category" operation, by the same production invariant. is_primary is
# deliberately left to its column default (false); the sync_domain_category_
# cache trigger (src/db/triggers.ts) promotes it to true itself once this
# statement commits, same as the real app's writes.
UPSERT_MEMBERSHIPS_SQL = """
INSERT INTO domain_categories (domain_id, category_id, feed_source_id, source_label)
SELECT d.id, %(category_id)s, %(feed_source_id)s, %(source_label)s
FROM tmp_domains t
JOIN domains d ON d.domain = t.domain
ON CONFLICT (domain_id) DO UPDATE SET
    category_id = EXCLUDED.category_id,
    feed_source_id = EXCLUDED.feed_source_id,
    source_label = EXCLUDED.source_label;
"""


def copy_into_staging(conn, domains: Iterable[str]) -> int:
    """Streams the cleaned domain list into tmp_domains via the real COPY
    wire protocol (psycopg2's copy_expert against an in-memory CSV
    buffer) — not execute_values (still N row-inserts, just batched) and
    never a per-row INSERT/ORM .save(). COPY skips per-row SQL parsing and
    planning entirely; landing in an UNLOGGED, unindexed staging table
    means no WAL writes and no index maintenance either. That combination
    is what keeps this fast at hundreds of thousands of rows — and unlike
    the real app's own bulkCreateDomains (which binds each row as literal
    SQL parameters and has to chunk at 2000 rows/statement to stay under
    Postgres' ~65535 bound-parameter limit), the INSERT...SELECT phases
    below bind NO per-row parameters at all, so there is no equivalent
    chunk-size limit to worry about here regardless of batch size.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    count = 0
    for domain in domains:
        writer.writerow([domain])
        count += 1
    buffer.seek(0)

    with conn.cursor() as cur:
        cur.execute(CREATE_STAGING_SQL)
        cur.copy_expert("COPY tmp_domains (domain) FROM STDIN WITH (FORMAT csv)", buffer)
    return count


def upsert_domains(conn, source: str, source_detail: str | None) -> int:
    with conn.cursor() as cur:
        cur.execute(UPSERT_DOMAINS_SQL, {"source": source, "source_detail": source_detail})
        return cur.rowcount


def upsert_memberships(conn, category_id: str, feed_source_id: str | None, source_label: str | None) -> int:
    with conn.cursor() as cur:
        cur.execute(
            UPSERT_MEMBERSHIPS_SQL,
            {"category_id": category_id, "feed_source_id": feed_source_id, "source_label": source_label},
        )
        return cur.rowcount


def truncate_staging(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("TRUNCATE tmp_domains;")


def assert_category_exists(conn, category_id: str) -> None:
    """Fails fast with a clear message instead of letting Phase B hit the
    domain_categories.category_id FK and surface a raw constraint-violation
    stack trace — same reasoning as the FK-violation translation in
    addDomainCategoryMemberships (src/db/queries.ts)."""
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM categories WHERE id = %s;", (category_id,))
        if cur.fetchone() is None:
            log.error('Category "%s" does not exist in `categories`. Valid ids:', category_id)
            cur.execute("SELECT id FROM categories ORDER BY id;")
            for (existing_id,) in cur.fetchall():
                log.error("  - %s", existing_id)
            sys.exit(1)


def assert_feed_source_exists(conn, feed_source_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM feed_sources WHERE id = %s;", (feed_source_id,))
        if cur.fetchone() is None:
            log.error('--feed-source-id "%s" does not exist in `feed_sources`.', feed_source_id)
            sys.exit(1)


def get_connection():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        log.error("DATABASE_URL is not set — export it first, e.g.:")
        log.error('  export DATABASE_URL="postgresql://user:pass@host:5432/dbname"')
        sys.exit(1)
    return psycopg2.connect(dsn)


def sync(
    input_path: str,
    category_id: str,
    source: str,
    source_detail: str | None,
    source_label: str | None,
    feed_source_id: str | None,
) -> None:
    t0 = time.perf_counter()
    domains = load_and_clean(input_path)
    t1 = time.perf_counter()
    log.info("Step 1-2: parsed + deduplicated %d domains in %.2fs", len(domains), t1 - t0)

    if not domains:
        log.warning("Nothing to sync — no valid domains parsed from %s", input_path)
        return

    conn = get_connection()
    try:
        assert_category_exists(conn, category_id)
        if feed_source_id:
            assert_feed_source_exists(conn, feed_source_id)

        loaded = copy_into_staging(conn, domains)
        t2 = time.perf_counter()
        log.info("Step 3: COPY'd %d rows into tmp_domains in %.2fs", loaded, t2 - t1)

        upserted_domains = upsert_domains(conn, source, source_detail)
        t3 = time.perf_counter()
        log.info("Step 4: upserted %d rows into domains in %.2fs", upserted_domains, t3 - t2)

        upserted_memberships = upsert_memberships(conn, category_id, feed_source_id, source_label)
        t4 = time.perf_counter()
        log.info(
            "Step 5: upserted %d rows into domain_categories (category=%s) in %.2fs — "
            "domains.categories/primary_category and categories.count are updated by the "
            "sync_domain_category_cache trigger, not by this script.",
            upserted_memberships, category_id, t4 - t3,
        )

        truncate_staging(conn)
        conn.commit()
        t5 = time.perf_counter()
        log.info("Total: %.2fs for %d input domains", t5 - t0, loaded)
    except Exception:
        conn.rollback()
        log.exception("Sync failed — transaction rolled back, no partial writes to domains/domain_categories")
        raise
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bulk-sync a raw domain blocklist feed into PostgreSQL, matching CyberDNS TIP's production schema."
    )
    parser.add_argument("--input", required=True, help="Path to the raw feed file (AdBlock/hosts/plain, mixed OK).")
    parser.add_argument("--category", required=True, help="categories.id this whole batch belongs to (must already exist).")
    parser.add_argument("--source", default="Bulk Sync Tool", help="domains.source label for newly-inserted rows.")
    parser.add_argument("--source-detail", default=None, help="domains.source_detail for newly-inserted rows.")
    parser.add_argument("--source-label", default="Bulk Sync Tool", help="domain_categories.source_label for this run.")
    parser.add_argument("--feed-source-id", default=None, help="feed_sources.id to attribute this run's memberships to (optional).")
    args = parser.parse_args()
    sync(args.input, args.category, args.source, args.source_detail, args.source_label, args.feed_source_id)


if __name__ == "__main__":
    main()
