export type DomainCategory =
  | 'all'
  | 'malware-phishing'
  | 'tracking-adware'
  | 'nsfw'
  | 'gambling'
  | 'social'
  | 'crypto-scam'
  | string;

export type DomainStatus = 'active' | 'grace_period' | 'unblocked' | 'allowlist' | 'protected';

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
  graceDaysLeft?: number;
  firstSeen: string;
  lastSeen: string;
  asn: string;
  domainAge: string;
  threatScore?: number; // 0.00 to 1.00
  isProtected?: boolean;
  timeline: {
    time: string;
    description: string;
    source: string;
    type: 'crawler' | 'feed' | 'manual' | 'system';
  }[];
  dnsRecords?: {
    a?: string[];
    aaaa?: string[];
    cname?: string | string[];
    mx?: string[];
    ns?: string[];
  };
  evidenceUrl?: string;
  tags?: string[];
}

export interface ReleaseItem {
  version: string;
  timestamp: string;
  status: 'running' | 'staged' | 'blocked' | 'rolled_back' | 'ready';
  categories: {
    category: string;
    current: number;
    added: number;
    removed: number;
    deltaPercent: number;
    safetyGate: 'passed' | 'warning' | 'failed' | 'unchanged';
  }[];
  diffSummary: {
    added: string[];
    removed: string[];
    totalAdded: number;
    totalRemoved: number;
  };
  blockedReason?: string;
  canaryNodes?: {
    nodeId: string;
    status: 'healthy' | 'deploying' | 'error';
    traffic: string;
    blockRatio: string;
  }[];
}

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
  requiresReview?: boolean;
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
  asnBreakdown: { asn: string; count: number }[];
  statusBreakdown: { status: string; count: number; percent: number }[];
  recentHighThreat: DomainItem[];
}

export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  category?: string;
  status?: string;
  count: number;
}
