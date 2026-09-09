export type DomainCategory =
  | 'all'
  | 'malware-phishing'
  | 'tracking-adware'
  | 'nsfw'
  | 'gambling'
  | 'social'
  | 'crypto-scam'
  | string;

// 'grace_period' removed per explicit request — only 3 user-facing statuses
// now. 'protected' (a system-managed status literal never actually written
// by any backend path) was also removed per explicit request: it always
// showed as a permanent, useless "Bảo vệ: 0" entry on every status
// breakdown card. The separate isProtected boolean flag (DomainItem below —
// protects specific domains like gov.vn from bulk actions, see
// DomainBulkModal.tsx) is a different mechanism and is unaffected.
export type DomainStatus = 'active' | 'unblocked' | 'allowlist';

// Sentinel value the "Nguồn Feed" filter (DomainTable.tsx) sends as
// feedSourceId to mean "domains with no feed-sourced membership at all"
// (every domain_categories row it has is manual/null-source) — mirrors
// MANUAL_SOURCE_FILTER in src/db/queries.ts exactly. Duplicated (not
// imported) because queries.ts pulls in server-only deps (pg, drizzle) that
// must never end up in the browser bundle.
export const MANUAL_SOURCE_FILTER = '__manual__';

export interface CategoryInfo {
  id: string;
  name: string;
  count: number;
  color: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  description?: string;
  deltaThreshold?: number; // e.g. 3% max delete
}

export interface DomainItem {
  id: string;
  domain: string;
  etld1: string;
  tld: string;
  categories: string[];
  primaryCategory: string;
  source: string;
  sourceDetail?: string;
  status: DomainStatus;
  firstSeen: string;
  lastSeen: string;
  isProtected?: boolean;
  timeline: {
    time: string;
    description: string;
    source: string;
    type: 'crawler' | 'feed' | 'manual' | 'system';
  }[];
  tags?: string[];
}

// (ReleaseItem removed along with the fictional release-pipeline backend —
// see src/db/schema.ts's note on the removed `releases` table.)

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  category: string;
  domainCount: number;
  lastSync: string | null;
  syncInterval: string;
  status: 'healthy' | 'warning' | 'error' | 'syncing' | 'idle';
  // Real progress while status === 'syncing' — see runFeedSourceSyncJob.
  syncProgress?: number;
  syncPhase?: string | null;
  isPaused?: boolean;
  color: string;
  removedToday?: number;
  errorMessage?: string;
  lastSyncMessage?: string | null;
  isCustom?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: 'add' | 'edit_group' | 'remove' | 'allowlist' | 'bulk_action' | 'release' | 'rollback';
  targetCount: number;
  summary: string;
  reason: string;
  canRollback: boolean;
  rollbackExpiresAt?: string;
  // false when canRollback is true but this entry predates structured
  // rollback data (or is a feed-sync bulk add, which never gets one — see
  // rollbackAuditLog in queries.ts) — the UI treats this the same as
  // !canRollback rather than showing a button that would just error.
  hasRollbackData?: boolean;
  details?: string[];
}

export interface ReviewDomainItem {
  id: string;
  domain: string;
  proposedCategory: string;
  threatScore: number;
  queryCount24h: number;
  reportedBy: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  screenshotUrl?: string;
  evidenceNotes: string;
}

export interface AppUser {
  id: number;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'Analyst' | 'Admin' | 'Reviewer';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginLog {
  id: number;
  userId: number | null;
  email: string;
  ipAddress: string;
  userAgent: string | null;
  success: boolean;
  isNewIp: boolean;
  failureReason: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalActive: number;
  totalAll: number;
  categoryBreakdown: { category: string; count: number; percent: number }[];
  tldBreakdown: { tld: string; count: number; percent: number }[];
  statusBreakdown: { status: string; count: number; percent: number }[];
  recentActive: DomainItem[];
  // Real daily count of newly-detected domains (grouped by domains.firstSeen)
  // for the last 30 days, oldest first — every day in the window is present
  // (even ones with 0), never sparse, so a trend chart never has to guess
  // whether a missing day means "zero" or "not loaded yet". See
  // getDashboardStats in queries.ts.
  domainGrowth: { date: string; count: number }[];
}

// Response shape of GET /api/domains/status-breakdown — the "TRẠNG THÁI
// BLOCKLIST" sidebar section's counts, scoped to whichever category is
// currently selected above it. Deliberately its own small type rather than
// reusing DashboardStats: this is always category-scoped and only ever
// needs totals + a status breakdown, not every field a full dashboard
// stats payload carries.
export interface CategoryStatusBreakdown {
  totalAll: number;
  statusBreakdown: { status: string; count: number }[];
}

// A real CyberDNS-operated DNS resolver — see src/db/schema.ts's dnsNodes
// note. Distinct from FeedSource: this is CyberDNS's own infrastructure
// inventory, not a threat-intel feed.
export interface DnsNode {
  id: number;
  name: string;
  hostname: string | null;
  // A node may have only an IPv4 address, only an IPv6 address, or both —
  // the app requires at least one of the two (see AddEditDnsNodeModal.tsx
  // and createDnsNode/updateDnsNode in src/db/queries.ts), never both null.
  ipAddress: string | null;
  ipv6Address: string | null;
  tier: 'LITE' | 'PRO' | 'FAMILY' | string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  provider: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// The single-row Blocklist-URL ACL switch — see blocklistAclSettings in
// schema.ts. enforceEnabled=false (the default) means every request is
// still served as before; only flipping it true actually starts rejecting
// IPs that don't match an active DnsNode.
export interface BlocklistAclSettings {
  enforceEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

// One row per distinct IP that has called a Blocklist URL without matching
// an active DnsNode — see blocklistUnknownRequesters in schema.ts. Surfaced
// in the DNS Nodes screen so an Admin can review real traffic before
// switching enforcement on.
export interface BlocklistUnknownRequester {
  ipAddress: string;
  firstSeenAt: string;
  lastSeenAt: string;
  requestCount: number;
  lastCategory: string | null;
}

// Country/Province reference data for the DNS Node form's location
// dropdowns — see src/lib/geo.ts (server) / GET /api/geo/* (server.ts).
// Deliberately tiny shapes: only what the dropdown + map preview actually
// need. Province-level (not city-level — see geo.ts's own note on why).
export interface GeoCountry {
  isoCode: string;
  name: string;
  flag: string;
}

export interface GeoProvince {
  name: string;
  latitude: number;
  longitude: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  category?: string;
  status?: string;
  count: number;
}
