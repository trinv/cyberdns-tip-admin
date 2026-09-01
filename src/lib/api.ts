import { DomainItem, CategoryInfo, FeedSource, ReleaseItem, AuditLog, ReviewDomainItem, DashboardStats, AppUser, LoginLog } from '../types';

export const API_BASE = '/api';

// Self-hosted session token (see src/middleware/auth.ts) — persisted in
// localStorage so a page reload doesn't sign the user out.
const TOKEN_STORAGE_KEY = 'cyberdns_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable (e.g. private browsing) — the session just
    // won't survive a page reload; nothing else to do about it here.
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Optional hook the app registers once (see App.tsx) to react centrally to
// "not signed in" (401) / "insufficient role" (403) responses — e.g. show a
// toast and offer the Google sign-in popup — without every individual
// mutation call site needing its own 401/403 branch.
let unauthorizedHandler: ((status: 401 | 403) => void) | null = null;
export function setUnauthorizedHandler(handler: ((status: 401 | 403) => void) | null) {
  unauthorizedHandler = handler;
}

// Attaches the stored session token (if signed in) as a Bearer token,
// matching what src/middleware/auth.ts verifies server-side. Kept `async`
// (trivially) so every existing `await authHeaders()` call site keeps working.
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function checkResponse(res: Response, fallbackMessage: string): Promise<void> {
  if (res.ok) return;
  if ((res.status === 401 || res.status === 403) && unauthorizedHandler) {
    unauthorizedHandler(res.status);
  }
  let message = fallbackMessage;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    // Non-JSON error body; keep the fallback message.
  }
  throw new ApiError(message, res.status);
}

export async function fetchHealth(): Promise<{ status: string; engine: string }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/dashboard/stats`);
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

export async function loginApi(email: string, password: string): Promise<{ token: string; user: AppUser; isNewIp?: boolean }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  await checkResponse(res, 'Đăng nhập thất bại');
  return res.json();
}

// Admin-only login audit trail (see GET /api/login-logs). userId scopes it
// to one account.
export async function fetchLoginLogs(userId?: number): Promise<LoginLog[]> {
  const query = userId ? `?userId=${userId}` : '';
  const res = await fetch(`${API_BASE}/login-logs${query}`, { headers: await authHeaders() });
  await checkResponse(res, 'Failed to fetch login logs');
  return res.json();
}

export async function logoutApi(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: await authHeaders() });
}

export async function fetchMe(): Promise<AppUser> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: await authHeaders() });
  await checkResponse(res, 'Failed to fetch current user');
  const data = await res.json();
  return data.user;
}

// Used only for the "restore session from a stored token on page load"
// check (see App.tsx) — a 401 here just means a leftover token expired or
// was invalidated, an expected/silent scenario, not a failed user action.
// Deliberately does NOT go through checkResponse/the global
// unauthorizedHandler, which would otherwise pop the "please log in"
// warning toast right on top of the login page the user is about to see.
// Every other authenticated call still goes through fetchMe/checkResponse
// as normal, so a session that expires mid-use is still surfaced.
export async function fetchMeSilently(): Promise<AppUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: await authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

// ---- User account management (Admin-only) ----
export async function fetchUsers(): Promise<AppUser[]> {
  const res = await fetch(`${API_BASE}/users`, { headers: await authHeaders() });
  await checkResponse(res, 'Failed to fetch users');
  return res.json();
}

export async function createUserApi(data: {
  email: string;
  password: string;
  displayName?: string;
  role?: string;
}): Promise<AppUser> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  await checkResponse(res, 'Failed to create user');
  const result = await res.json();
  return result.user;
}

export async function updateUserApi(
  id: number,
  patch: { role?: string; isActive?: boolean; displayName?: string; password?: string }
): Promise<AppUser> {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  await checkResponse(res, 'Failed to update user');
  const result = await res.json();
  return result.user;
}

export async function fetchCategories(): Promise<CategoryInfo[]> {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function createCategoryApi(category: Partial<CategoryInfo>): Promise<CategoryInfo> {
  const res = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(category),
  });
  await checkResponse(res, 'Failed to create category');
  const data = await res.json();
  return data.category;
}

export async function fetchDomains(params: {
  search?: string;
  category?: string;
  // Normally a single status value (the sidebar's status filter is a
  // single-select dropdown); comma-separated multi-status is still
  // accepted server-side, see getDomains() in queries.ts.
  status?: string;
  tld?: string;
  // The real feed_sources.id (or the MANUAL_SOURCE_FILTER sentinel — see
  // src/db/queries.ts), not domains.source's free-text label — see
  // getDomains' own note on why that label can't reliably answer "which
  // domains does source X currently back."
  feedSourceId?: string;
  limit?: number;
  offset?: number;
  sortField?: 'domain' | 'firstSeen' | 'lastSeen';
  sortDirection?: 'asc' | 'desc';
}): Promise<{ domains: DomainItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.category && params.category !== 'all') query.set('category', params.category);
  if (params.status) query.set('status', params.status);
  if (params.tld) query.set('tld', params.tld);
  if (params.feedSourceId) query.set('feedSourceId', params.feedSourceId);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortDirection) query.set('sortDirection', params.sortDirection);

  const res = await fetch(`${API_BASE}/domains?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch domains');
  return res.json();
}

export async function updateDomainApi(
  id: number | string,
  patch: Partial<DomainItem>,
  reason?: string
): Promise<DomainItem> {
  const res = await fetch(`${API_BASE}/domains/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ ...patch, reason }),
  });
  await checkResponse(res, 'Failed to update domain');
  const data = await res.json();
  return data.domain;
}

// Manual single add — submits to review_queue instead of writing straight
// to domains (see server.ts POST /api/domains/propose).
export async function proposeDomainApi(data: {
  domain: string;
  categories: string[];
  reason?: string;
}): Promise<{ insertedCount: number; skippedCount: number }> {
  const res = await fetch(`${API_BASE}/domains/propose`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  await checkResponse(res, 'Failed to propose domain for review');
  return res.json();
}

// Batch/paste import — same as proposeDomainApi, many domains at once.
export async function proposeBulkDomainsApi(data: {
  domains: string[];
  categories: string[];
  reason?: string;
}): Promise<{ insertedCount: number; skippedCount: number }> {
  const res = await fetch(`${API_BASE}/domains/bulk-propose`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  await checkResponse(res, 'Failed to propose domains for review');
  return res.json();
}

export async function bulkActionDomainsApi(data: {
  action: 'add_group' | 'allowlist' | 'unblock' | 'block';
  domainIds: (string | number)[];
  category?: string;
  reason: string;
}): Promise<{ success: boolean; updatedCount: number }> {
  const numericIds = data.domainIds
    .map((id) => (typeof id === 'string' && id.startsWith('dom-') ? null : Number(id)))
    .filter((id): id is number => id !== null && !isNaN(id));

  const res = await fetch(`${API_BASE}/domains/bulk-action`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      ...data,
      domainIds: numericIds,
    }),
  });
  await checkResponse(res, 'Failed to perform bulk action');
  return res.json();
}

export async function updateCategoryApi(id: string, patch: Partial<CategoryInfo>): Promise<CategoryInfo> {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  await checkResponse(res, 'Failed to update category');
  const data = await res.json();
  return data.category;
}

export async function deleteCategoryApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  await checkResponse(res, 'Failed to delete category');
}

export async function fetchFeedSources(): Promise<FeedSource[]> {
  const res = await fetch(`${API_BASE}/sources`);
  if (!res.ok) throw new Error('Failed to fetch feed sources');
  return res.json();
}

export async function createFeedSourceApi(data: Partial<FeedSource>): Promise<FeedSource> {
  const res = await fetch(`${API_BASE}/sources`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  await checkResponse(res, 'Failed to create feed source');
  const result = await res.json();
  return result.source;
}

export async function syncFeedSourceApi(id: string): Promise<FeedSource> {
  const res = await fetch(`${API_BASE}/sources/${id}/sync`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  await checkResponse(res, 'Failed to sync feed source');
  const result = await res.json();
  return result.source;
}

export async function pauseFeedSourceApi(id: string): Promise<{ source: FeedSource; affectedCount: number }> {
  const res = await fetch(`${API_BASE}/sources/${id}/pause`, { method: 'POST', headers: await authHeaders() });
  await checkResponse(res, 'Failed to pause feed source');
  return res.json();
}

export async function resumeFeedSourceApi(id: string): Promise<{ source: FeedSource; affectedCount: number }> {
  const res = await fetch(`${API_BASE}/sources/${id}/resume`, { method: 'POST', headers: await authHeaders() });
  await checkResponse(res, 'Failed to resume feed source');
  return res.json();
}

export async function deleteFeedSourceApi(id: string): Promise<{ affectedCount: number }> {
  const res = await fetch(`${API_BASE}/sources/${id}`, { method: 'DELETE', headers: await authHeaders() });
  await checkResponse(res, 'Failed to delete feed source');
  return res.json();
}

export async function fetchReviewQueue(status: string = 'pending'): Promise<ReviewDomainItem[]> {
  const res = await fetch(`${API_BASE}/reviews?status=${status}`);
  if (!res.ok) throw new Error('Failed to fetch review queue');
  return res.json();
}

export async function resolveReviewItemApi(
  id: number | string,
  decision: 'approved' | 'rejected',
  category?: string
): Promise<ReviewDomainItem> {
  const res = await fetch(`${API_BASE}/reviews/${id}/resolve`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ decision, category }),
  });
  await checkResponse(res, 'Failed to resolve review item');
  const data = await res.json();
  return data.item;
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/audit-logs`);
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function rollbackAuditLogApi(logId: string, reason?: string): Promise<{ success: boolean; summary: string }> {
  const res = await fetch(`${API_BASE}/audit-logs/${encodeURIComponent(logId)}/rollback`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reason }),
  });
  await checkResponse(res, 'Hoàn tác giao dịch thất bại');
  return res.json();
}

export async function fetchReleases(): Promise<ReleaseItem[]> {
  const res = await fetch(`${API_BASE}/releases`);
  if (!res.ok) throw new Error('Failed to fetch releases');
  return res.json();
}

export async function deployReleaseApi(version: string): Promise<ReleaseItem> {
  const res = await fetch(`${API_BASE}/releases/${encodeURIComponent(version)}/deploy`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  await checkResponse(res, 'Failed to deploy release');
  const result = await res.json();
  return result.release;
}

export async function overrideReleaseApi(version: string, reason: string): Promise<ReleaseItem> {
  const res = await fetch(`${API_BASE}/releases/${encodeURIComponent(version)}/override`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reason }),
  });
  await checkResponse(res, 'Failed to override release safety gate');
  const result = await res.json();
  return result.release;
}

export async function rollbackReleaseApi(version: string, reason: string): Promise<ReleaseItem> {
  const res = await fetch(`${API_BASE}/releases/${encodeURIComponent(version)}/rollback`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reason }),
  });
  await checkResponse(res, 'Failed to rollback release');
  const result = await res.json();
  return result.release;
}
