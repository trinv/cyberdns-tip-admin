import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  varchar,
  index,
} from 'drizzle-orm/pg-core';

// 1. Users Table — self-hosted email/password accounts (no external IdP).
// email is the login identifier; passwordHash is `scrypt salt:hash` (see
// src/lib/password.ts). isActive is the revoke switch: a deactivated
// account's existing sessions are rejected on their very next request (see
// getSessionUser in queries.ts) without needing to hunt down every token.
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    // Least-privilege default: a brand-new account must be promoted to Admin
    // explicitly by an existing Admin — it must never be granted implicitly.
    role: varchar('role', { length: 50 }).default('Analyst').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// 1b. Sessions — opaque bearer tokens issued on login. Deleting a row (logout)
// or flipping users.isActive to false (revoke) invalidates access immediately;
// no JWT-style stateless-token complexity (blocklists, short expiries) needed.
export const sessions = pgTable(
  'sessions',
  {
    token: varchar('token', { length: 64 }).primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)]
);

// 1c. Login Logs — one row per real login attempt (success AND failure),
// recording the real client IP/User-Agent. isNewIp is computed at insert
// time (see recordLoginAttempt in queries.ts): true when this is the first
// SUCCESSFUL login PostgreSQL has on record for this user from this exact
// IP — the basis for the "unrecognized IP" warning shown right after such a
// login (see resolveLoginAttempt's return value / POST /api/auth/login).
export const loginLogs = pgTable(
  'login_logs',
  {
    id: serial('id').primaryKey(),
    // Nullable: a failed attempt against an email that doesn't exist has no
    // real user row to reference, but is still worth logging as a signal.
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    ipAddress: varchar('ip_address', { length: 64 }).notNull(),
    userAgent: text('user_agent'),
    success: boolean('success').notNull(),
    isNewIp: boolean('is_new_ip').default(false).notNull(),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('login_logs_user_idx').on(table.userId),
    index('login_logs_created_at_idx').on(table.createdAt),
  ]
);

// 2. Categories Table
export const categories = pgTable(
  'categories',
  {
    id: varchar('id', { length: 100 }).primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    count: integer('count').default(0).notNull(),
    color: varchar('color', { length: 20 }).default('#10B981').notNull(),
    borderColor: varchar('border_color', { length: 50 }).default('border-emerald-500/30').notNull(),
    badgeBg: varchar('badge_bg', { length: 50 }).default('bg-emerald-500/10').notNull(),
    badgeText: varchar('badge_text', { length: 50 }).default('text-emerald-500').notNull(),
    deltaThreshold: integer('delta_threshold').default(3).notNull(), // Max allowed deletion delta %
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// 3. Domains Table (Core Threat Intel Inventory)
export const domains = pgTable(
  'domains',
  {
    id: serial('id').primaryKey(),
    domain: text('domain').notNull().unique(),
    etld1: text('etld1').notNull(),
    tld: varchar('tld', { length: 50 }).notNull(),
    // `categories` and `primaryCategory` below are a DENORMALIZED CACHE, not
    // the source of truth — they exist so existing read queries (jsonb
    // containment filters, list views) don't need a JOIN. The authoritative
    // data lives in `domainCategories`; a Postgres trigger (see
    // src/db/triggers.ts) keeps these two columns in sync automatically on
    // every insert/delete against domainCategories. Never write to these two
    // columns directly from application code — write to domainCategories
    // instead and let the trigger derive them.
    categories: jsonb('categories').$type<string[]>().default([]).notNull(),
    primaryCategory: varchar('primary_category', { length: 100 }),
    source: text('source').notNull(),
    sourceDetail: text('source_detail'),
    status: varchar('status', { length: 50 }).default('active').notNull(), // 'active' | 'unblocked' | 'allowlist' | 'protected' — 'grace_period' removed per explicit request
    // True only when the CURRENT 'unblocked' status was set automatically by
    // pauseFeedSource/deleteFeedSource (queries.ts) reacting to its feed
    // source being paused/deleted — never by a human explicitly choosing to
    // unblock this domain. This is what lets resumeFeedSource re-activate
    // exactly (and only) the domains its own pause affected, instead of also
    // sweeping up domains someone deliberately unblocked for an unrelated
    // reason. Any explicit status change (updateDomain / bulkUpdateDomains)
    // clears it back to false.
    unblockedBySourcePause: boolean('unblocked_by_source_pause').default(false).notNull(),
    firstSeen: timestamp('first_seen').defaultNow().notNull(),
    lastSeen: timestamp('last_seen').defaultNow().notNull(),
    // asn / domainAge / dnsRecords / evidenceUrl / threatScore removed: none
    // of the five was ever backed by a real data pipeline (no WHOIS/ASN
    // lookup, no DNS resolver, no crawler-produced evidence URL, no actual
    // threat-scoring model exists in this system) — every value stored here
    // was always either a hardcoded honest-default placeholder ('Unknown
    // ASN', 'Unknown', {}) or a fixed constant (threatScore 0.5/0.85 chosen
    // by which code path wrote it, never computed). Keeping unused columns
    // around also cost real write throughput: every domain row is smaller
    // and cheaper to insert/update without them.
    isProtected: boolean('is_protected').default(false).notNull(),
    timeline: jsonb('timeline').$type<Array<{
      time: string;
      description: string;
      source: string;
      type: 'crawler' | 'feed' | 'manual' | 'system';
    }>>().default([]).notNull(),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    // No separate index on `domain` here — .unique() above already creates
    // one (Postgres backs a UNIQUE constraint with its own btree index), so
    // an explicit index('...').on(table.domain) would be a second, fully
    // redundant index on the exact same single column: identical lookup
    // performance, but double the index-maintenance cost on every insert/
    // update — real write overhead on every domain in every sync, for zero
    // read benefit. (This existed as `domains_domain_idx` until this fix.)
    index('domains_status_idx').on(table.status),
    index('domains_primary_category_idx').on(table.primaryCategory),
    index('domains_tld_idx').on(table.tld),
    // Backs the Domain Explorer's default sort (getDomains defaults to
    // lastSeen desc when no sortField is requested) — without this, every
    // unsorted-by-choice page load had to fully sort the entire filtered
    // result set before applying LIMIT.
    index('domains_last_seen_idx').on(table.lastSeen),
  ]
);

// 4. Feed Sources Table
export const feedSources = pgTable(
  'feed_sources',
  {
    id: varchar('id', { length: 100 }).primaryKey(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    domainCount: integer('domain_count').default(0).notNull(),
    // Null until the source has actually been synced once — defaulting this
    // to "now" at creation time (the old behavior) falsely implied a source
    // had already fetched data the moment it was added.
    lastSync: timestamp('last_sync'),
    syncInterval: varchar('sync_interval', { length: 50 }).default('1 giờ').notNull(),
    // 'idle' (never synced) | 'syncing' | 'healthy' | 'warning' | 'error'
    status: varchar('status', { length: 50 }).default('idle').notNull(),
    // Real progress while status = 'syncing', updated incrementally by the
    // background sync job (see runFeedSourceSyncJob in queries.ts) — 0-100.
    syncProgress: integer('sync_progress').default(0).notNull(),
    // Human-readable current step, e.g. "Đang tải dữ liệu (42%)...",
    // "Đang phân tích...", "Đang ghi vào CyberDNSTIP-DB (3/12)..." — null
    // when not currently syncing.
    syncPhase: text('sync_phase'),
    // When true: excluded from "Đồng bộ tất cả" / the sync button is
    // disabled, and every domain this source is currently linked to (via
    // domain_categories.feedSourceId) has been moved to 'unblocked' — see
    // pauseFeedSource/resumeFeedSource in queries.ts.
    isPaused: boolean('is_paused').default(false).notNull(),
    color: varchar('color', { length: 20 }).default('#10B981').notNull(),
    removedToday: integer('removed_today').default(0).notNull(),
    errorMessage: text('error_message'),
    // Neutral (non-error) human-readable outcome of the most recent
    // successful sync, e.g. "Đã nạp 41.485 domain — 12.300 mới, 29.185 đã
    // tồn tại" — kept separate from errorMessage so the UI doesn't render a
    // successful sync's summary inside a red error box.
    lastSyncMessage: text('last_sync_message'),
    isCustom: boolean('is_custom').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// 4b. Domain ↔ Category Membership (the authoritative relation)
//
// A domain can belong to MULTIPLE categories at once, AND the same
// (domain, category) pair can be independently backed by MULTIPLE sources
// at once — e.g. both a Hagezi feed AND an OISD feed pointed at the same
// "Malware" category, both legitimately reporting the same domain. The
// real uniqueness is therefore the (domainId, categoryId, feedSourceId)
// TRIPLE, enforced via a raw-SQL "NULLS NOT DISTINCT" unique index applied
// in ensureDomainCategoryTriggers (src/db/triggers.ts) — not expressible
// through this schema DSL, and NULLS NOT DISTINCT matters here specifically
// so multiple manual entries (feedSourceId null) for the same domain+
// category still collapse into one row instead of accumulating duplicates.
// Without per-source rows, pausing source A when source B ALSO backs the
// same domain+category would silently overwrite/lose A's own attribution
// the moment B re-synced (last writer wins) — this is what tracking each
// source's own row prevents: pausing/deleting A only ever touches A's row,
// never B's, regardless of sync order.
//
// feedSourceId is ON DELETE CASCADE (not SET NULL): with feedSourceId part
// of the unique key, nulling it out on the source's deletion could collide
// with an already-existing manual (null-source) row for the same domain+
// category, violating the constraint mid-delete. Deleting this source's OWN
// row instead is both safe and more honest — if another source (or a
// manual entry) still backs this domain+category, that row is untouched
// and nothing is lost; if this was the only backing, the row disappearing
// matches deleteFeedSource() already having unblocked the domain for
// exactly that reason.
//
// `isPrimary` marks the one row (per domain, not per category — a domain
// can have several rows sharing the same category_id now) considered "the"
// category for contexts that need a single value — display sort order, the
// CSV export's primary_category column, domains.primaryCategory's
// denormalized value — always the domain's OLDEST membership by addedAt
// (see the sync trigger's promotion logic in src/db/triggers.ts), not a
// ranking of importance. Which specific row (of possibly several sharing
// that category) holds the flag doesn't matter — the derived category_id
// value is the same either way.
export const domainCategories = pgTable(
  'domain_categories',
  {
    id: serial('id').primaryKey(),
    domainId: integer('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    categoryId: varchar('category_id', { length: 100 })
      .notNull()
      // RESTRICT (not cascade): deleting a category that still has domains
      // in it must fail loudly (see deleteCategory in queries.ts) instead of
      // silently orphaning those domains from all categorization.
      .references(() => categories.id, { onDelete: 'restrict' }),
    // Which feed run added this specific membership, when known — nullable
    // because manual entries have none. See the file-level note above for
    // why this is ON DELETE CASCADE, not SET NULL.
    feedSourceId: varchar('feed_source_id', { length: 100 }).references(() => feedSources.id, {
      onDelete: 'cascade',
    }),
    // Human-readable provenance for this one membership (e.g. 'hagezi/gambling'
    // or 'Thủ công (SOC Analyst)') — distinct from feedSourceId because not
    // every source is a tracked feed row.
    sourceLabel: text('source_label'),
    isPrimary: boolean('is_primary').default(false).notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [
    // The real (domainId, categoryId, feedSourceId) uniqueness lives in
    // triggers.ts as a raw "NULLS NOT DISTINCT" index — see the file-level
    // note above for why. domainId/categoryId here are for lookups only,
    // not a substitute for that constraint.
    index('domain_categories_domain_idx').on(table.domainId),
    index('domain_categories_category_idx').on(table.categoryId),
    index('domain_categories_feed_source_idx').on(table.feedSourceId),
  ]
);

// 5. Release Pipeline Table
export const releases = pgTable(
  'releases',
  {
    id: serial('id').primaryKey(),
    version: varchar('version', { length: 50 }).notNull().unique(),
    status: varchar('status', { length: 50 }).default('ready').notNull(), // 'running' | 'staged' | 'blocked' | 'rolled_back' | 'ready'
    categories: jsonb('categories').$type<Array<{
      category: string;
      current: number;
      added: number;
      removed: number;
      deltaPercent: number;
      safetyGate: 'passed' | 'warning' | 'failed' | 'unchanged';
    }>>().default([]).notNull(),
    diffSummary: jsonb('diff_summary').$type<{
      added: string[];
      removed: string[];
      totalAdded: number;
      totalRemoved: number;
    }>().default({ added: [], removed: [], totalAdded: 0, totalRemoved: 0 }).notNull(),
    blockedReason: text('blocked_reason'),
    canaryNodes: jsonb('canary_nodes').$type<Array<{
      nodeId: string;
      status: 'healthy' | 'deploying' | 'error';
      traffic: string;
      blockRatio: string;
    }>>().default([]).notNull(),
    releasedBy: text('released_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// 6. Review Queue Table (Pending CTI Analyst Verification)
export const reviewQueue = pgTable(
  'review_queue',
  {
    id: serial('id').primaryKey(),
    domain: text('domain').notNull(),
    proposedCategory: varchar('proposed_category', { length: 100 }).notNull(),
    threatScore: doublePrecision('threat_score').default(0.5).notNull(),
    queryCount24h: integer('query_count_24h').default(0).notNull(),
    reportedBy: text('reported_by').notNull(),
    // Nullable — set only for items a feed sync proposed (a legacy path;
    // feed syncs always auto-block directly now, see runFeedSourceSyncJob,
    // so this stays null for every new item, which all come from manual
    // add / batch import instead). Kept so already-approved domains from
    // that path remain traceable via domain_categories.feedSourceId (see
    // resolveReviewItem), and so old pending rows from before this change
    // still carry their real provenance.
    feedSourceId: varchar('feed_source_id', { length: 100 }).references(() => feedSources.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
    reason: text('reason').notNull(),
    screenshotUrl: text('screenshot_url'),
    evidenceNotes: text('evidence_notes').default('').notNull(),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('review_status_idx').on(table.status),
  ]
);

// 7. Audit Logs Table (Full SOC Governance & Rollback capability)
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    user: text('user').notNull(),
    role: varchar('role', { length: 50 }).default('Admin').notNull(),
    action: varchar('action', { length: 50 }).notNull(), // 'add' | 'edit_group' | 'remove' | 'allowlist' | 'bulk_action' | 'release' | 'rollback'
    targetCount: integer('target_count').default(1).notNull(),
    summary: text('summary').notNull(),
    reason: text('reason').notNull(),
    canRollback: boolean('can_rollback').default(false).notNull(),
    rollbackExpiresAt: timestamp('rollback_expires_at'),
    // Structured "before" state needed to actually reverse this specific
    // transaction — null for log entries that predate this feature (their
    // "Hoàn tác" button shows a clear "no data to undo" message instead of
    // silently doing nothing) and for entries that are deliberately never
    // rollbackable (canRollback: false), e.g. a feed-sync bulk add, which
    // can touch hundreds of thousands of domains — see rollbackAuditLog in
    // queries.ts for the shape per action type.
    rollbackData: jsonb('rollback_data').$type<Record<string, unknown> | null>(),
    details: jsonb('details').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_created_at_idx').on(table.createdAt),
    index('audit_logs_action_idx').on(table.action),
  ]
);

// 8. Saved Filters Table
export const savedFilters = pgTable(
  'saved_filters',
  {
    id: varchar('id', { length: 100 }).primaryKey(),
    name: text('name').notNull(),
    query: text('query').default('').notNull(),
    category: varchar('category', { length: 100 }),
    status: varchar('status', { length: 50 }),
    count: integer('count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);
