# bulk-domain-sync

Standalone reference implementation for syncing a large raw domain
blocklist feed into PostgreSQL as fast as Postgres allows — matching
CyberDNS TIP's **actual production schema** (`src/db/schema.ts`) exactly,
not a simplified stand-in table.

## How this maps onto the production schema

The real `domains` table is denormalized: `domains.categories` (a jsonb
array) and `domains.primary_category` are a **read-path cache**, not the
source of truth. The real relation is `domain_categories` — a domain can
belong to **several** categories at once (e.g. reported as both "malware"
and "phishing" by two different feeds); the unique constraint is on the
`(domain_id, category_id)` **pair**, not `domain_id` alone. A Postgres
trigger (`sync_domain_category_cache`, copied verbatim into `schema.sql`
from `src/db/triggers.ts`) keeps that cache — and `categories.count` — in
sync automatically on every insert/update/delete against `domain_categories`.

`sync_domains.py` therefore **never writes `domains.categories` or
`primary_category` directly** — exactly like the real app's own
`createDomain`/`bulkCreateDomains` + `addDomainCategoryMemberships` in
`src/db/queries.ts`. It writes two tables, in one transaction:

1. **`domains`** — one set-based `INSERT ... SELECT ... ON CONFLICT
   (domain) DO UPDATE`, computing `etld1`/`tld` in SQL with the same
   heuristic the app uses. An existing domain is reset to
   `status = 'active'` (a feed re-listing it means "still blocked",
   overriding e.g. a stale `'unblocked'`) — matching
   `bulkCreateDomains`'s own `onConflictDoUpdate` exactly.
2. **`domain_categories`** — one `INSERT ... SELECT ... ON CONFLICT
   (domain_id, category_id) DO UPDATE`, joining the staging table to
   `domains` on domain name to get the id (no id bookkeeping needed in
   Python). A domain already in this category is a no-op/refresh; already
   in a different category, it keeps that one and gains this one too (a
   different pair, so a fresh row, not a conflict) — matching
   `addDomainCategoryMemberships`'s `onConflictDoUpdate` exactly.

The trigger then derives `domains.categories`/`primary_category` and
`categories.count` from that — this script touches neither.

**Not covered** (by design — out of scope for "write a domain list into
Postgres"): the `feed_sources` table's own bookkeeping (`domain_count`,
`last_sync`, `status`, `sync_progress`). Pass `--feed-source-id` purely
for `domain_categories`' provenance tracking if this run corresponds to a
real row there.

## Why each step is built this way

1. **Parse + dedupe in Python, before the database is involved at all**
   (`load_and_clean` in `sync_domains.py`, or `clean_dedupe.sh` for a
   pure-shell equivalent using `sort -u`).

2. **`UNLOGGED` staging table**, one column (`domain`). `UNLOGGED` skips
   WAL (write-ahead log) writes entirely — its one real cost (content
   doesn't survive a crash) is irrelevant here: the table exists only to
   stage one run's input and gets `TRUNCATE`d at the end of every run.

3. **Real `COPY`, not `execute_values`, not a `.save()` loop.**
   `copy_expert` against an in-memory CSV buffer — the actual `COPY` wire
   protocol, skipping per-row SQL parsing/planning entirely.

4. **Two set-based upserts, not a loop, and no bound-parameter chunking.**
   Both the `domains` and `domain_categories` writes are a single
   `INSERT ... SELECT` each, over the whole batch. Unlike the real app's
   `bulkCreateDomains` (which binds each row as a literal SQL parameter
   and has to chunk at 2000 rows/statement to stay under Postgres'
   ~65535 bound-parameter limit), `INSERT ... SELECT ... FROM tmp_domains`
   binds **zero** per-row parameters — there's no equivalent chunk-size
   ceiling here regardless of batch size.

5. **Fail fast on an unknown category.** `--category` is checked against
   `categories` up front, with the valid ids listed, instead of letting
   the `domain_categories.category_id` foreign key surface a raw
   constraint-violation stack trace mid-run — same reasoning as the
   FK-violation translation in `addDomainCategoryMemberships`.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt

# Against a real CyberDNS TIP database, this is a no-op (everything
# already exists via the app's own `npm run db:push` + trigger install).
# Against a fresh/empty database, this provisions everything needed to
# run this tool standalone.
psql "$DATABASE_URL" -f schema.sql
```

## Run

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
python sync_domains.py \
    --input blocklist.txt \
    --category malware \
    --source "Feed: Hagezi Malware" \
    --source-label "hagezi/malware" \
    --feed-source-id hagezi-malware   # optional
```

`--category` must already exist as a `categories.id` in the target
database (create it via the app's UI/API first, or `INSERT INTO
categories (id, name) VALUES (...)`).

Re-running with the same file is safe and cheap — both upserts are
idempotent (`ON CONFLICT ... DO UPDATE` converges to the same end state),
so a second run changes nothing and `categories.count` doesn't drift.

## Verified against a real PostgreSQL instance

This isn't just reviewed code — the full pipeline (parse → COPY → upsert
`domains` → upsert `domain_categories` → trigger-derived cache/count) was
run against a real Postgres database provisioned from `schema.sql`,
in an isolated schema (never against a live app's actual data):

- 20,000 mixed-format domains synced in ~2.7s.
- Re-run: fully idempotent — same row counts, `categories.count` did not
  double.
- Synced under a **different** `--category` on a later run: the domain
  gained the second category *in addition to* the first (`domains.categories`
  ended up `["malware", "phishing"]`, both categories' counts incremented
  independently) — additive, never a move, matching the main app's own
  "Thêm vào nhóm" behavior.
- Unknown `--category`: fails fast with a clear message and the list of
  valid ids, before touching `domains` at all.

## Optional: shell-only preprocessing

```bash
./clean_dedupe.sh raw_feed.txt > clean_feed.txt
```

Produces the same cleaned, deduplicated domain list as `sync_domains.py`'s
own parsing step, entirely via `grep`/`sed`/`sort -u` — useful for
eyeballing a feed, or feeding some other tool, without running any
Python or touching the database.
