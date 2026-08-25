import { db } from './index.ts';
import {
  users,
  sessions,
  loginLogs,
  categories,
  domains,
  domainCategories,
  feedSources,
  releases,
  reviewQueue,
  auditLogs,
  savedFilters,
} from './schema.ts';
import { eq, desc, asc, sql, ilike, and, inArray } from 'drizzle-orm';
import { parseFeedText } from './feedParser.ts';
import { hashPassword, verifyPassword, generateSessionToken, generateTempPassword } from '../lib/password.ts';

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

// Never let a passwordHash leak out of this module into an API response.
function toSafeUser(u: typeof users.$inferSelect) {
  const { passwordHash, ...safe } = u;
  return safe;
}

// 1. Authentication (self-hosted email/password — no external identity provider)
export async function authenticateUser(email: string, password: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) return null;
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return null;
    return toSafeUser(user);
  } catch (error) {
    console.error('authenticateUser failed:', error);
    throw new Error('Failed to authenticate user', { cause: error });
  }
}

// Looks up a user's id by email regardless of password/active status — used
// ONLY by the login route to attach a real userId to a FAILED login-log
// entry (e.g. "right email, wrong password") without changing what
// authenticateUser() reveals to the actual login response (which must stay
// a generic "email or password incorrect" either way).
export async function findUserIdByEmail(email: string): Promise<number | null> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  return rows[0]?.id ?? null;
}

export async function createSession(userId: number): Promise<string> {
  const token = generateSessionToken();
  await db.insert(sessions).values({ token, userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return token;
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

// 1d. Login logging + new-IP detection. Records EVERY attempt (success and
// failure) with the real client IP/User-Agent — see server.ts's `trust
// proxy` setting, which is what makes req.ip reflect the real visitor
// instead of the Nginx reverse proxy's own address.
//
// isNewIp is true when this is the first successful login PostgreSQL has on
// record for this user from this exact IP. Never throws: a failure here
// must not block a real login, so any error is logged and swallowed.
export async function recordLoginAttempt(params: {
  userId: number | null;
  email: string;
  ipAddress: string;
  userAgent?: string | null;
  success: boolean;
  failureReason?: string | null;
}): Promise<{ isNewIp: boolean }> {
  try {
    let isNewIp = false;
    if (params.success && params.userId) {
      const priorFromThisIp = await db
        .select({ id: loginLogs.id })
        .from(loginLogs)
        .where(
          and(
            eq(loginLogs.userId, params.userId),
            eq(loginLogs.ipAddress, params.ipAddress),
            eq(loginLogs.success, true)
          )
        )
        .limit(1);
      isNewIp = priorFromThisIp.length === 0;
    }

    await db.insert(loginLogs).values({
      userId: params.userId,
      email: params.email.toLowerCase().trim(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent || null,
      success: params.success,
      isNewIp,
      failureReason: params.failureReason || null,
    });

    return { isNewIp };
  } catch (error) {
    console.error('recordLoginAttempt failed:', error);
    return { isNewIp: false };
  }
}

// Login history — Admin-only (see requireRole('Admin') in server.ts).
// Passing userId scopes it to one account (e.g. "show my own recent
// logins"); omitted, it's every account's attempts, most recent first.
export async function getLoginLogs(params: { userId?: number; limit?: number } = {}) {
  try {
    const whereClause = params.userId ? eq(loginLogs.userId, params.userId) : undefined;
    return await db
      .select()
      .from(loginLogs)
      .where(whereClause)
      .orderBy(desc(loginLogs.createdAt))
      .limit(params.limit || 200);
  } catch (error) {
    console.error('getLoginLogs failed:', error);
    throw new Error('Failed to retrieve login logs', { cause: error });
  }
}

// Resolves a bearer token to its (safe) user row, honoring both session
// expiry and account revocation (isActive) — this is what every
// authenticated request goes through, via src/middleware/auth.ts.
export async function getSessionUser(token: string) {
  try {
    const rows = await db
      .select({ user: users, expiresAt: sessions.expiresAt })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.token, token))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    if (!row.user.isActive) return null;
    return toSafeUser(row.user);
  } catch (error) {
    console.error('getSessionUser failed:', error);
    return null;
  }
}

// 1b. User account management (Admin-only — see requireRole('Admin') guards in server.ts)
export async function listUsers() {
  try {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return rows.map(toSafeUser);
  } catch (error) {
    console.error('listUsers failed:', error);
    throw new Error('Failed to list users', { cause: error });
  }
}

export async function createUserAccount(data: { email: string; password: string; displayName?: string; role?: string }) {
  try {
    const passwordHash = await hashPassword(data.password);
    const result = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase().trim(),
        passwordHash,
        displayName: data.displayName || null,
        role: data.role || 'Analyst',
      })
      .returning();
    return toSafeUser(result[0]);
  } catch (error: any) {
    if (error?.code === '23505' || error?.cause?.code === '23505') {
      throw new Error(`Email "${data.email}" đã được sử dụng.`);
    }
    console.error('createUserAccount failed:', error);
    throw new Error('Failed to create user account', { cause: error });
  }
}

// Refuses to demote/deactivate the last remaining active Admin — without
// this, an operator could accidentally lock every admin-only action
// (including undoing the change itself) out of the system.
async function assertNotLastActiveAdmin(excludingUserId: number) {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'Admin'), eq(users.isActive, true)));
  if (!admins.some((a) => a.id !== excludingUserId)) {
    throw new Error('Không thể thực hiện: đây là tài khoản Admin đang hoạt động cuối cùng trong hệ thống.');
  }
}

export async function updateUserAccount(
  id: number,
  patch: { role?: string; isActive?: boolean; displayName?: string; password?: string }
) {
  try {
    if (patch.role !== undefined && patch.role !== 'Admin') {
      await assertNotLastActiveAdmin(id);
    }
    if (patch.isActive === false) {
      await assertNotLastActiveAdmin(id);
    }

    const setValues: Record<string, any> = { updatedAt: new Date() };
    if (patch.role !== undefined) setValues.role = patch.role;
    if (patch.isActive !== undefined) setValues.isActive = patch.isActive;
    if (patch.displayName !== undefined) setValues.displayName = patch.displayName;
    if (patch.password) setValues.passwordHash = await hashPassword(patch.password);

    const updated = await db.update(users).set(setValues).where(eq(users.id, id)).returning();
    if (!updated[0]) throw new Error(`User id ${id} not found`);

    // Revoking access kills existing sessions immediately instead of
    // waiting for them to naturally expire over the next 30 days.
    if (patch.isActive === false) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    return toSafeUser(updated[0]);
  } catch (error) {
    console.error('updateUserAccount failed:', error);
    throw error instanceof Error ? error : new Error('Failed to update user account', { cause: error });
  }
}

// 1c. Bootstrap: guarantee at least one active Admin account exists so the
// system is never unreachable. There is no email/SMS delivery in this app,
// so the generated credentials are printed to the server console instead —
// change the password after first login via the user management panel.
export async function ensureSuperAdmin() {
  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'Admin'), eq(users.isActive, true)))
      .limit(1);
    if (existing.length > 0) return;

    const email = process.env.SUPERADMIN_EMAIL || 'admin@cyberdns.local';
    const password = process.env.SUPERADMIN_PASSWORD || generateTempPassword();
    const passwordHash = await hashPassword(password);

    await db
      .insert(users)
      .values({ email, passwordHash, displayName: 'Super Admin', role: 'Admin', isActive: true })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash, role: 'Admin', isActive: true, updatedAt: new Date() },
      });

    console.log('============================================================');
    console.log(' Đã tạo tài khoản Super Admin cho CyberDNS TIP:');
    console.log(`   Email:    ${email}`);
    console.log(`   Mật khẩu: ${password}`);
    console.log(' Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu.');
    console.log('============================================================');
  } catch (error) {
    console.error('ensureSuperAdmin failed:', error);
  }
}

// 2b. Domain ↔ Category membership helpers (used by every write path below).
// These are the ONLY places that should touch domain_categories — everything
// else derives from it via the sync trigger (src/db/triggers.ts).

// A domain belongs to exactly one category at a time (domainId is uniquely
// constrained in domain_categories — see schema.ts). Re-adding a domain that
// is already in this exact category is a no-op change (same row, same
// values); re-adding it under a DIFFERENT category MOVES it there — the old
// membership is overwritten, not left alongside a second row. The sync
// trigger reacts to that UPDATE and keeps domains.categories/primaryCategory
// and both categories' live counts accurate automatically.
async function addDomainCategoryMemberships(
  rows: { domainId: number; categoryId: string; sourceLabel?: string | null; feedSourceId?: string | null }[]
) {
  if (rows.length === 0) return;
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    // A single INSERT statement can't target the same conflict key (domainId)
    // twice, and "the same domain into two categories in one call" has no
    // valid meaning under the one-category-per-domain rule anyway — de-dupe
    // by domainId within this chunk first (last entry wins).
    const byDomainId = new Map<number, (typeof chunk)[number]>();
    for (const r of chunk) byDomainId.set(r.domainId, r);

    await db
      .insert(domainCategories)
      .values(
        Array.from(byDomainId.values()).map((r) => ({
          domainId: r.domainId,
          categoryId: r.categoryId,
          sourceLabel: r.sourceLabel || null,
          feedSourceId: r.feedSourceId || null,
        }))
      )
      .onConflictDoUpdate({
        target: domainCategories.domainId,
        set: {
          categoryId: sql`excluded.category_id`,
          sourceLabel: sql`excluded.source_label`,
          feedSourceId: sql`excluded.feed_source_id`,
        },
      });
  }
}

async function removeDomainCategoryMemberships(domainIds: number[], categoryId: string) {
  if (domainIds.length === 0) return;
  await db
    .delete(domainCategories)
    .where(and(inArray(domainCategories.domainId, domainIds), eq(domainCategories.categoryId, categoryId)));
}

// 3. Dashboard aggregate stats — computed live from the domains table.
// NOTE: this deliberately only surfaces numbers the schema can actually back
// (counts/percentages grouped from real rows). Time-series query volume,
// brand-impersonation analytics and per-incident attack classification are
// NOT included here because there is no DNS query-log/telemetry ingestion
// pipeline yet to source them from — the dashboard keeps those sections
// clearly labeled as illustrative rather than wiring them to fabricated data.
export async function getDashboardStats() {
  try {
    const activeFilter = eq(domains.status, 'active');

    const [totalActiveRows, totalAllRows, categoryRows, tldRows, asnRows, statusRows, recentHighThreat] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(domains).where(activeFilter),
      db.select({ count: sql<number>`count(*)` }).from(domains),
      db
        .select({ category: domains.primaryCategory, count: sql<number>`count(*)` })
        .from(domains)
        .where(activeFilter)
        .groupBy(domains.primaryCategory)
        .orderBy(desc(sql`count(*)`))
        .limit(8),
      db
        .select({ tld: domains.tld, count: sql<number>`count(*)` })
        .from(domains)
        .where(activeFilter)
        .groupBy(domains.tld)
        .orderBy(desc(sql`count(*)`))
        .limit(6),
      db
        .select({ asn: domains.asn, count: sql<number>`count(*)` })
        .from(domains)
        .where(activeFilter)
        .groupBy(domains.asn)
        .orderBy(desc(sql`count(*)`))
        .limit(6),
      // Every status, not just 'active' — this is what backs the real
      // "Active / Ân hạn / Allowlist / Đã thôi chặn" breakdown in the
      // dashboard's total-blocked detail modal (see MetricDetailModal.tsx).
      db
        .select({ status: domains.status, count: sql<number>`count(*)` })
        .from(domains)
        .groupBy(domains.status),
      db
        .select()
        .from(domains)
        .where(activeFilter)
        .orderBy(desc(domains.threatScore), desc(domains.lastSeen))
        .limit(6),
    ]);

    const totalActive = Number(totalActiveRows[0]?.count || 0);
    const totalAll = Number(totalAllRows[0]?.count || 0);

    return {
      totalActive,
      totalAll,
      categoryBreakdown: categoryRows.map((c) => ({
        category: c.category,
        count: Number(c.count),
        percent: totalActive > 0 ? (Number(c.count) / totalActive) * 100 : 0,
      })),
      tldBreakdown: tldRows.map((t) => ({
        tld: t.tld,
        count: Number(t.count),
        percent: totalActive > 0 ? (Number(t.count) / totalActive) * 100 : 0,
      })),
      asnBreakdown: asnRows.map((a) => ({ asn: a.asn || 'Unknown ASN', count: Number(a.count) })),
      statusBreakdown: statusRows.map((s) => ({
        status: s.status,
        count: Number(s.count),
        percent: totalAll > 0 ? (Number(s.count) / totalAll) * 100 : 0,
      })),
      recentHighThreat,
    };
  } catch (error) {
    console.error('getDashboardStats failed:', error);
    throw new Error('Failed to compute dashboard stats', { cause: error });
  }
}

// 4. Domain Queries & Mutations
const DOMAIN_SORT_COLUMNS = {
  domain: domains.domain,
  firstSeen: domains.firstSeen,
  lastSeen: domains.lastSeen,
  threatScore: domains.threatScore,
} as const;

export async function getDomains(params: {
  search?: string;
  category?: string;
  // Comma-separated list of statuses (matches the Domain Explorer's
  // multi-select status checkboxes), e.g. "active,grace_period".
  status?: string;
  tld?: string;
  source?: string;
  // Omit both to fetch every matching row with no LIMIT/OFFSET — used by the
  // "xuất toàn bộ danh mục" export flow. The paginated Domain Explorer view
  // always passes an explicit limit (its page size), so this never silently
  // changes that behavior.
  limit?: number;
  offset?: number;
  sortField?: keyof typeof DOMAIN_SORT_COLUMNS;
  sortDirection?: 'asc' | 'desc';
}) {
  try {
    const { search, category, status, tld, source, limit, offset = 0, sortField, sortDirection } = params;

    const conditions = [];

    if (search && search.trim() !== '') {
      conditions.push(ilike(domains.domain, `%${search.trim()}%`));
    }
    if (category && category !== 'all') {
      conditions.push(sql`${domains.categories} @> ${JSON.stringify([category])}::jsonb`);
    }
    if (status && status.trim() !== '') {
      const statusList = status.split(',').map((s) => s.trim()).filter(Boolean);
      if (statusList.length === 1) conditions.push(eq(domains.status, statusList[0]));
      else if (statusList.length > 1) conditions.push(inArray(domains.status, statusList));
    }
    if (tld) {
      conditions.push(eq(domains.tld, tld));
    }
    if (source) {
      conditions.push(eq(domains.source, source));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumn = DOMAIN_SORT_COLUMNS[sortField || 'lastSeen'] || domains.lastSeen;
    const orderExpr = sortDirection === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const baseQuery = db.select().from(domains).where(whereClause).orderBy(orderExpr);
    const [items, countResult] = await Promise.all([
      limit !== undefined ? baseQuery.limit(limit).offset(offset) : baseQuery,
      db
        .select({ count: sql<number>`count(*)` })
        .from(domains)
        .where(whereClause),
    ]);

    return {
      domains: items,
      total: Number(countResult[0]?.count || 0),
    };
  } catch (error) {
    console.error('getDomains failed:', error);
    throw new Error('Failed to retrieve domains from PostgreSQL', { cause: error });
  }
}

export async function updateDomain(
  id: number,
  patch: {
    categories?: string[];
    status?: string;
    asn?: string;
    domainAge?: string;
    sourceDetail?: string;
    tags?: string[];
    evidenceUrl?: string;
    isProtected?: boolean;
    graceDaysLeft?: number;
    threatScore?: number;
  },
  meta: { userEmail?: string; reason?: string } = {}
) {
  try {
    const setValues: Record<string, any> = { updatedAt: new Date() };
    // Any explicit status change here is a human decision — clear the
    // "auto-unblocked by a paused source" marker regardless of which status
    // it's changing to, so a later resumeFeedSource never second-guesses it.
    if (patch.status !== undefined) { setValues.status = patch.status; setValues.unblockedBySourcePause = false; }
    if (patch.asn !== undefined) setValues.asn = patch.asn;
    if (patch.domainAge !== undefined) setValues.domainAge = patch.domainAge;
    if (patch.sourceDetail !== undefined) setValues.sourceDetail = patch.sourceDetail;
    if (patch.tags !== undefined) setValues.tags = patch.tags;
    if (patch.evidenceUrl !== undefined) setValues.evidenceUrl = patch.evidenceUrl;
    if (patch.isProtected !== undefined) setValues.isProtected = patch.isProtected;
    if (patch.graceDaysLeft !== undefined) setValues.graceDaysLeft = patch.graceDaysLeft;
    if (patch.threatScore !== undefined) setValues.threatScore = patch.threatScore;

    let updated = await db.update(domains).set(setValues).where(eq(domains.id, id)).returning();
    if (!updated[0]) throw new Error(`Domain id ${id} not found`);

    // Reconcile category membership to the desired full set instead of
    // writing categories/primaryCategory directly (see schema.ts note):
    // add what's missing, remove what's no longer wanted, leave any
    // untouched membership's original addedAt/sourceLabel intact.
    if (patch.categories !== undefined) {
      const desired = new Set(patch.categories);
      const current = new Set(updated[0].categories || []);

      const toAdd = [...desired].filter((c) => !current.has(c));
      const toRemove = [...current].filter((c) => !desired.has(c));

      if (toAdd.length > 0) {
        await addDomainCategoryMemberships(
          toAdd.map((categoryId) => ({ domainId: id, categoryId, sourceLabel: meta.reason || 'Manual edit' }))
        );
      }
      for (const categoryId of toRemove) {
        await removeDomainCategoryMemberships([id], categoryId);
      }

      // Re-select: the sync trigger has now updated categories/primaryCategory.
      updated = await db.select().from(domains).where(eq(domains.id, id));
    }

    await db.insert(auditLogs).values({
      user: meta.userEmail || 'Analyst (Manual)',
      role: 'SecOps',
      action: 'edit_group',
      targetCount: 1,
      summary: `Cập nhật cấu hình tên miền: ${updated[0].domain}`,
      reason: meta.reason || 'Cập nhật phân loại theo bằng chứng mới',
      canRollback: true,
      rollbackExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      details: [`Tên miền: ${updated[0].domain}`, `Trạng thái: ${updated[0].status}`],
    });

    return updated[0];
  } catch (error) {
    console.error('updateDomain failed:', error);
    throw new Error('Failed to update domain record', { cause: error });
  }
}

export async function createDomain(data: {
  domain: string;
  categories: string[];
  source?: string;
  reason?: string;
  userEmail?: string;
  // Set when this call originates from a feed (directly, or via an
  // approved review-queue item that was itself reported by a feed — see
  // resolveReviewItem) so the resulting domain_categories row stays
  // traceable to its source, same as a directly-auto-blocked domain.
  feedSourceId?: string;
}) {
  try {
    const cleanDomain = data.domain.toLowerCase().trim();
    const parts = cleanDomain.split('.');
    const tld = parts.length > 1 ? parts[parts.length - 1] : 'vn';
    const etld1 = parts.length > 2 ? `${parts[parts.length - 2]}.${tld}` : cleanDomain;
    const sourceLabel = data.source || 'Thủ công (SOC Analyst)';

    // Upsert the domain identity row itself (categories are NOT set here —
    // see addDomainCategoryMemberships below and the note on schema.ts).
    const upserted = await db
      .insert(domains)
      .values({
        domain: cleanDomain,
        etld1,
        tld,
        source: sourceLabel,
        sourceDetail: `Thêm bởi ${data.userEmail || 'Analyst'} - Lý do: ${data.reason || 'Bổ sung IOC thủ công'}`,
        status: 'active',
        // No WHOIS/ASN lookup pipeline exists yet — 'Unknown ASN'/'Unknown'
        // (the column defaults) are the honest values here, not a
        // specific-looking fabricated ASN or age. threatScore 0.85 mirrors
        // bulkCreateDomains' manual-entry default: a human analyst adding a
        // domain has already made a judgment call that it's malicious.
        asn: 'Unknown ASN',
        domainAge: 'Unknown',
        threatScore: 0.85,
        timeline: [
          {
            time: new Date().toISOString(),
            description: `Thêm vào danh sách chặn (${data.categories.join(', ')})`,
            source: data.userEmail || 'SOC Analyst',
            type: 'manual',
          },
        ],
      })
      .onConflictDoUpdate({
        target: domains.domain,
        set: {
          status: 'active',
          // An explicit (re-)block always clears the "auto-unblocked by a
          // paused source" marker, whatever it was before.
          unblockedBySourcePause: false,
          updatedAt: new Date(),
        },
      })
      .returning({ id: domains.id });

    const domainId = upserted[0].id;

    // Idempotent: re-adding a domain to a category it's already in is a
    // silent no-op (DB-enforced), never a duplicate membership row.
    await addDomainCategoryMemberships(
      data.categories.map((categoryId) => ({ domainId, categoryId, sourceLabel, feedSourceId: data.feedSourceId }))
    );

    // Re-select so the caller gets the trigger-updated categories/primaryCategory.
    const finalRows = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);

    // Log to audit log
    await db.insert(auditLogs).values({
      user: data.userEmail || 'Analyst (Manual)',
      role: 'SecOps',
      action: 'add',
      targetCount: 1,
      summary: `Thêm thủ công tên miền: ${cleanDomain}`,
      reason: data.reason || 'Bổ sung IOC thủ công',
      canRollback: true,
      rollbackExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      details: [`Tên miền: ${cleanDomain}`, `Nhóm: ${data.categories.join(', ')}`],
    });

    return finalRows[0];
  } catch (error) {
    console.error('createDomain failed:', error);
    throw new Error('Failed to create domain record', { cause: error });
  }
}

export async function bulkCreateDomains(data: {
  domains: string[];
  categories: string[];
  source?: string;
  reason?: string;
  userEmail?: string;
  feedSourceId?: string;
  // Called after each insert chunk with how many of the deduplicated input
  // domains have been written so far — lets a caller (feed sync) surface
  // real incremental progress instead of a single opaque "please wait".
  onChunkProgress?: (processed: number, total: number) => void | Promise<void>;
}) {
  try {
    const cleanDomains = Array.from(
      new Set(data.domains.map((d) => d.toLowerCase().trim()).filter(Boolean))
    );
    if (cleanDomains.length === 0) return { domains: [], insertedCount: 0, newCount: 0, existingCount: 0 };

    // Real dedup accounting: how many of these domains were already in the
    // DB (from this or any other source) before this sync, vs genuinely new.
    // Chunked (same reasoning as the inserts below) to stay under Postgres'
    // bound-parameter limit for very large feeds.
    const EXISTENCE_CHUNK_SIZE = 10_000;
    const existingSet = new Set<string>();
    for (let i = 0; i < cleanDomains.length; i += EXISTENCE_CHUNK_SIZE) {
      const chunk = cleanDomains.slice(i, i + EXISTENCE_CHUNK_SIZE);
      const existingRows = await db.select({ domain: domains.domain }).from(domains).where(inArray(domains.domain, chunk));
      for (const r of existingRows) existingSet.add(r.domain);
    }
    const existingCount = existingSet.size;
    const newCount = cleanDomains.length - existingCount;

    const sourceLabel = data.source || 'Nhập hàng loạt (Batch Import)';
    const now = new Date();

    const rows = cleanDomains.map((cleanDomain) => {
      const parts = cleanDomain.split('.');
      const tld = parts.length > 1 ? parts[parts.length - 1] : 'vn';
      const etld1 = parts.length > 2 ? `${parts[parts.length - 2]}.${tld}` : cleanDomain;
      return {
        domain: cleanDomain,
        etld1,
        tld,
        source: sourceLabel,
        sourceDetail: `Nhập bởi ${data.userEmail || 'Analyst'} - Lý do: ${data.reason || 'Nhập hàng loạt IOC'}`,
        status: 'active',
        asn: 'Unknown ASN',
        domainAge: 'Unknown',
        threatScore: 0.85,
        timeline: [
          {
            time: now.toISOString(),
            description: `Nhập hàng loạt vào danh sách chặn (${data.categories.join(', ')})`,
            source: data.userEmail || 'SOC Analyst',
            type: 'manual' as const,
          },
        ],
      };
    });

    // Chunk the insert so very large feeds/pasted lists stay well under
    // Postgres' ~65535 bound-parameter limit per statement.
    const CHUNK_SIZE = 500;
    const upserted: { id: number; domain: string }[] = [];
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const result = await db
        .insert(domains)
        .values(chunk)
        .onConflictDoUpdate({
          target: domains.domain,
          set: { status: 'active', updatedAt: now },
        })
        .returning({ id: domains.id, domain: domains.domain });
      upserted.push(...result);
      await data.onChunkProgress?.(upserted.length, rows.length);
    }

    // Idempotent per (domainId, categoryId): re-running the same import, or a
    // feed re-listing a domain it already reported, creates zero duplicates.
    await addDomainCategoryMemberships(
      upserted.flatMap((d) =>
        data.categories.map((categoryId) => ({
          domainId: d.id,
          categoryId,
          sourceLabel,
          feedSourceId: data.feedSourceId,
        }))
      )
    );

    // Re-select so the returned rows reflect the trigger-updated cache
    // (categories/primaryCategory), not their pre-membership state. Chunked
    // for the same bound-parameter reason as the inserts above.
    const finalIds = upserted.map((d) => d.id);
    const inserted: (typeof domains.$inferSelect)[] = [];
    for (let i = 0; i < finalIds.length; i += EXISTENCE_CHUNK_SIZE) {
      const idChunk = finalIds.slice(i, i + EXISTENCE_CHUNK_SIZE);
      inserted.push(...(await db.select().from(domains).where(inArray(domains.id, idChunk))));
    }

    await db.insert(auditLogs).values({
      user: data.userEmail || 'Analyst (Batch Import)',
      role: 'SecOps',
      action: 'add',
      targetCount: inserted.length,
      summary: `Nhập hàng loạt ${inserted.length} tên miền vào nhóm ${data.categories.join(', ')} (${newCount.toLocaleString('vi-VN')} mới, ${existingCount.toLocaleString('vi-VN')} đã tồn tại)`,
      reason: data.reason || 'Nhập hàng loạt IOC',
      canRollback: true,
      rollbackExpiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
      details: [`Số lượng: ${inserted.length}`, `Nhóm: ${data.categories.join(', ')}`, `Mới: ${newCount}`, `Đã tồn tại: ${existingCount}`],
    });

    return { domains: inserted, insertedCount: inserted.length, newCount, existingCount };
  } catch (error) {
    console.error('bulkCreateDomains failed:', error);
    throw new Error('Failed to bulk import domains', { cause: error });
  }
}

export async function bulkUpdateDomains(params: {
  action: 'add_group' | 'remove_group' | 'allowlist' | 'unblock';
  domainIds?: number[];
  category?: string;
  reason: string;
  userEmail?: string;
}) {
  try {
    const { action, domainIds = [], category, reason, userEmail = 'Admin' } = params;

    if (domainIds.length === 0) return { updatedCount: 0 };

    if (action === 'allowlist') {
      await db
        .update(domains)
        .set({
          status: 'allowlist',
          // Explicit human action — no longer just a side-effect of a
          // paused source, whatever it was before.
          unblockedBySourcePause: false,
          updatedAt: new Date(),
        })
        .where(inArray(domains.id, domainIds));
    } else if (action === 'unblock') {
      await db
        .update(domains)
        .set({
          status: 'unblocked',
          unblockedBySourcePause: false,
          updatedAt: new Date(),
        })
        .where(inArray(domains.id, domainIds));
    } else if (action === 'add_group' && category) {
      // Idempotent: domains already in this category are silently skipped
      // (DB-enforced unique membership), not duplicated.
      await addDomainCategoryMemberships(
        domainIds.map((domainId) => ({ domainId, categoryId: category, sourceLabel: reason || 'Bulk action' }))
      );
    } else if (action === 'remove_group' && category) {
      // Deleting the membership row is enough — the sync trigger
      // automatically reassigns primaryCategory for any domain that just
      // lost its primary membership (promotes its oldest remaining one, or
      // clears it to null if this was its only category).
      await removeDomainCategoryMemberships(domainIds, category);
    }

    // Insert Audit Log
    await db.insert(auditLogs).values({
      user: userEmail,
      role: 'Admin',
      action: 'bulk_action',
      targetCount: domainIds.length,
      summary: `Thực hiện thao tác hàng loạt [${action}] trên ${domainIds.length} tên miền`,
      reason: reason || 'SOC Bulk Policy Update',
      canRollback: true,
      rollbackExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      details: [`Hành động: ${action}`, `Số lượng: ${domainIds.length}`, `Lý do: ${reason}`],
    });

    return { success: true, updatedCount: domainIds.length };
  } catch (error) {
    console.error('bulkUpdateDomains failed:', error);
    throw new Error('Failed to perform bulk domain action', { cause: error });
  }
}

// 4. Categories Queries & Mutations
export async function getCategories() {
  try {
    return await db.select().from(categories).orderBy(desc(categories.count));
  } catch (error) {
    console.error('getCategories failed:', error);
    throw new Error('Failed to retrieve categories', { cause: error });
  }
}

export async function createCategory(data: {
  id: string;
  name: string;
  description?: string;
  color?: string;
  deltaThreshold?: number;
}) {
  try {
    const res = await db
      .insert(categories)
      .values({
        id: data.id,
        name: data.name,
        description: data.description || null,
        color: data.color || '#10B981',
        deltaThreshold: data.deltaThreshold || 3,
      })
      .returning();
    return res[0];
  } catch (error: any) {
    if (error?.code === '23505' || error?.cause?.code === '23505') {
      throw new Error(`Nhóm danh mục "${data.id}" đã tồn tại.`);
    }
    console.error('createCategory failed:', error);
    throw new Error('Failed to create category', { cause: error });
  }
}

export async function updateCategory(
  id: string,
  patch: { name?: string; description?: string; color?: string; deltaThreshold?: number }
) {
  try {
    const setValues: Record<string, any> = { updatedAt: new Date() };
    if (patch.name !== undefined) setValues.name = patch.name;
    if (patch.description !== undefined) setValues.description = patch.description;
    if (patch.color !== undefined) setValues.color = patch.color;
    if (patch.deltaThreshold !== undefined) setValues.deltaThreshold = patch.deltaThreshold;

    const updated = await db.update(categories).set(setValues).where(eq(categories.id, id)).returning();
    if (!updated[0]) throw new Error(`Category ${id} not found`);
    return updated[0];
  } catch (error) {
    console.error('updateCategory failed:', error);
    throw new Error('Failed to update category', { cause: error });
  }
}

export async function deleteCategory(id: string) {
  try {
    const deleted = await db.delete(categories).where(eq(categories.id, id)).returning();
    if (!deleted[0]) throw new Error(`Category ${id} not found`);
    return deleted[0];
  } catch (error: any) {
    // domain_categories.category_id is ON DELETE RESTRICT (see schema.ts) —
    // deleting a category that still has domains in it must fail loudly
    // instead of silently orphaning those domains, so surface a message an
    // operator can act on rather than a raw FK-violation error. Drizzle
    // wraps the real pg error in `.cause`, so check both levels.
    const pgCode = error?.code || error?.cause?.code;
    if (pgCode === '23503') {
      const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(domainCategories)
        .where(eq(domainCategories.categoryId, id));
      const count = Number(countRes[0]?.count || 0);
      throw new Error(
        `Không thể xoá nhóm "${id}" vì vẫn còn ${count} tên miền thuộc nhóm này. Vui lòng chuyển các tên miền sang nhóm khác trước.`
      );
    }
    console.error('deleteCategory failed:', error);
    throw new Error('Failed to delete category', { cause: error });
  }
}

// 5. Feed Sources Queries & Mutations
export async function getFeedSources() {
  try {
    return await db.select().from(feedSources).orderBy(desc(feedSources.domainCount));
  } catch (error) {
    console.error('getFeedSources failed:', error);
    throw new Error('Failed to retrieve feed sources', { cause: error });
  }
}

export async function createFeedSource(data: {
  name: string;
  url: string;
  category: string;
  syncInterval?: string;
  color?: string;
  isCustom?: boolean;
  requiresReview?: boolean;
}) {
  try {
    const slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const id = `${slug || 'feed'}-${Date.now().toString(36)}`;

    // A brand-new source has never fetched anything — domainCount/lastSync
    // must NOT be trusted from the client (the UI used to send a made-up
    // domainCount and "just synced" timestamp here). It starts truly empty
    // and 'idle' until the first real sync completes.
    const created = await db
      .insert(feedSources)
      .values({
        id,
        name: data.name,
        url: data.url,
        category: data.category,
        domainCount: 0,
        lastSync: null,
        syncInterval: data.syncInterval || '4 giờ',
        status: 'idle',
        syncProgress: 0,
        requiresReview: data.requiresReview ?? false,
        color: data.color || '#10B981',
        isCustom: data.isCustom ?? true,
      })
      .returning();

    return created[0];
  } catch (error) {
    console.error('createFeedSource failed:', error);
    throw new Error('Failed to create feed source', { cause: error });
  }
}

// Feed sync is a real background job, not a request/response round-trip:
// startFeedSourceSync() flips the row to 'syncing' and returns immediately
// (a few ms); runFeedSourceSyncJob() then keeps running server-side to
// completion regardless of whether the client is still connected, still on
// the Sources tab, or has navigated away — the ONLY source of truth for
// "is this syncing, and how far along" is this row in Postgres, which every
// client polls via GET /api/sources. This is what makes progress survive a
// tab switch: there is no client-side "isSyncing" state to lose.
const activeSyncs = new Set<string>();

export async function startFeedSourceSync(id: string) {
  const existing = await db.select().from(feedSources).where(eq(feedSources.id, id)).limit(1);
  const source = existing[0];
  if (!source) throw new Error(`Feed source ${id} not found`);
  if (source.isPaused) {
    throw new Error(`Nguồn "${source.name}" đang tạm dừng — hãy bấm "Tiếp tục" trước khi đồng bộ lại.`);
  }
  if (activeSyncs.has(id) || source.status === 'syncing') {
    // Already running — just return current state rather than starting a
    // second overlapping job against the same source.
    return source;
  }

  activeSyncs.add(id);
  const started = await db
    .update(feedSources)
    .set({ status: 'syncing', syncProgress: 0, syncPhase: 'Đang kết nối...', errorMessage: null, updatedAt: new Date() })
    .where(eq(feedSources.id, id))
    .returning();

  // Deliberately not awaited — this is the fire-and-forget background job.
  runFeedSourceSyncJob(id).finally(() => activeSyncs.delete(id));

  return started[0];
}

async function setSyncProgress(id: string, progress: number, phase: string) {
  try {
    await db
      .update(feedSources)
      .set({ syncProgress: Math.max(0, Math.min(100, Math.round(progress))), syncPhase: phase, updatedAt: new Date() })
      .where(eq(feedSources.id, id));
  } catch (error) {
    // Progress updates are best-effort — never let a progress-write failure
    // abort the sync itself.
    console.error(`setSyncProgress failed for source ${id}:`, error);
  }
}

// Real sync pipeline: (1) download the ENTIRE feed body to local memory
// with real byte-progress from the response stream, (2) parse it into a
// deduplicated domain list, (3) bulk-upsert into PostgreSQL in chunks
// (domains.domain is UNIQUE, so this is also where cross-source duplicates
// get collapsed — see bulkCreateDomains), reporting progress incrementally
// at every stage so GET /api/sources always reflects real, current state.
//
// Scope note: this only ADDS domains. It does not yet detect "this domain
// used to be in the feed and just disappeared" and react to it (e.g. move to
// grace_period) — that needs a proper diff-against-last-sync + safety-gate
// flow, which is what the Releases feature is headed toward, not something
// to bolt on here silently.
async function runFeedSourceSyncJob(id: string) {
  const fail = async (message: string) => {
    await db
      .update(feedSources)
      .set({ status: 'error', errorMessage: message, syncProgress: 0, syncPhase: null, updatedAt: new Date() })
      .where(eq(feedSources.id, id));
  };

  try {
    const existing = await db.select().from(feedSources).where(eq(feedSources.id, id)).limit(1);
    const source = existing[0];
    if (!source) return;

    // --- Phase 1: download the full feed to local memory (0-50%) ---
    let feedText: string;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
      let response: Response;
      try {
        // Some CDNs/feed hosts (e.g. jsdelivr) reject requests with no/an
        // empty User-Agent as a basic bot-blocking heuristic — a plain
        // Node fetch trips this and gets a 403, so identify honestly instead.
        response = await fetch(source.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'CyberDNS-TIP-FeedSync/1.0 (+https://cyberdns.vn)' },
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (response.body) {
        // Stream the body manually so real bytes-received progress is
        // available instead of blocking opaquely on response.text().
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const chunks: string[] = [];
        let received = 0;
        let lastReportedPercent = -1;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            received += value.byteLength;
            chunks.push(decoder.decode(value, { stream: true }));
            if (contentLength > 0) {
              const percent = Math.min(50, (received / contentLength) * 50);
              // Only write to the DB when the visible percentage actually
              // moves, so a fast local feed doesn't spam updates.
              if (Math.floor(percent) !== lastReportedPercent) {
                lastReportedPercent = Math.floor(percent);
                await setSyncProgress(id, percent, `Đang tải dữ liệu (${(received / 1024).toFixed(0)} KB / ${(contentLength / 1024).toFixed(0)} KB)...`);
              }
            } else {
              // No Content-Length header — report bytes received without a
              // denominator instead of a fake percentage.
              await setSyncProgress(id, Math.min(45, received / 20_000), `Đang tải dữ liệu (${(received / 1024).toFixed(0)} KB)...`);
            }
          }
        }
        chunks.push(decoder.decode());
        feedText = chunks.join('');
      } else {
        feedText = await response.text();
      }
    } catch (fetchError: any) {
      await fail(`Không tải được feed: ${fetchError?.message || String(fetchError)}`);
      return;
    }

    await setSyncProgress(id, 52, 'Đang phân tích dữ liệu...');

    // --- Phase 2: parse + dedupe locally (52-58%) ---
    const { domains: parsedDomains } = parseFeedText(feedText);

    if (parsedDomains.length === 0) {
      await db
        .update(feedSources)
        .set({
          status: 'warning',
          errorMessage: 'Đồng bộ hoàn tất nhưng không phân tích được domain hợp lệ nào từ nội dung feed.',
          lastSync: new Date(),
          syncProgress: 0,
          syncPhase: null,
          updatedAt: new Date(),
        })
        .where(eq(feedSources.id, id));
      return;
    }

    await setSyncProgress(id, 58, `Đã phân tích ${parsedDomains.length.toLocaleString('vi-VN')} domain — đang kiểm tra trùng lặp và ghi vào PostgreSQL...`);

    // --- Phase 3: write to PostgreSQL (58-100%) ---
    if (source.requiresReview) {
      // Lower-confidence source: newly-discovered domains are NOT
      // auto-blocked — they're queued in review_queue for a SOC analyst to
      // confirm first (see resolveReviewItem). Domains this feed reports
      // that are already tracked elsewhere are left untouched rather than
      // being sent back through review again.
      const CHECK_CHUNK = 10_000;
      const existingSet = new Set<string>();
      for (let i = 0; i < parsedDomains.length; i += CHECK_CHUNK) {
        const chunk = parsedDomains.slice(i, i + CHECK_CHUNK);
        const rows = await db.select({ domain: domains.domain }).from(domains).where(inArray(domains.domain, chunk));
        for (const r of rows) existingSet.add(r.domain);
      }
      const newDomains = parsedDomains.filter((d) => !existingSet.has(d));

      const reviewResult = await bulkCreateReviewItems({
        domains: newDomains,
        proposedCategory: source.category,
        reportedBy: `Feed: ${source.name}`,
        feedSourceId: id,
        reason: `Phát hiện qua đồng bộ nguồn feed "${source.name}" — nguồn này được cấu hình yêu cầu xác nhận thủ công trước khi chặn.`,
        onChunkProgress: async (processed, total) => {
          const percent = 58 + (processed / Math.max(total, 1)) * 42;
          await setSyncProgress(id, percent, `Đang đưa vào Hàng đợi duyệt (${processed.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')})...`);
        },
      });

      await db
        .update(feedSources)
        .set({
          lastSync: new Date(),
          status: 'healthy',
          errorMessage: null,
          lastSyncMessage: `Đã phân tích ${parsedDomains.length.toLocaleString('vi-VN')} domain — ${reviewResult.insertedCount.toLocaleString('vi-VN')} domain mới đã đưa vào Hàng đợi duyệt, ${(existingSet.size + reviewResult.skippedCount).toLocaleString('vi-VN')} đã tồn tại hoặc đang chờ duyệt (bỏ qua).`,
          domainCount: parsedDomains.length,
          syncProgress: 100,
          syncPhase: null,
          updatedAt: new Date(),
        })
        .where(eq(feedSources.id, id));
      return;
    }

    const result = await bulkCreateDomains({
      domains: parsedDomains,
      categories: [source.category],
      source: `Feed: ${source.name}`,
      reason: `Đồng bộ tự động từ nguồn feed ${source.name}`,
      feedSourceId: id,
      onChunkProgress: async (processed, total) => {
        const percent = 58 + (processed / total) * 42;
        await setSyncProgress(id, percent, `Đang ghi vào PostgreSQL (${processed.toLocaleString('vi-VN')}/${total.toLocaleString('vi-VN')})...`);
      },
    });

    await db
      .update(feedSources)
      .set({
        lastSync: new Date(),
        status: 'healthy',
        errorMessage: null,
        lastSyncMessage: `Đã nạp ${parsedDomains.length.toLocaleString('vi-VN')} domain — ${result.newCount.toLocaleString('vi-VN')} mới, ${result.existingCount.toLocaleString('vi-VN')} đã tồn tại (trùng lặp, đã bỏ qua/cập nhật).`,
        domainCount: parsedDomains.length,
        syncProgress: 100,
        syncPhase: null,
        updatedAt: new Date(),
      })
      .where(eq(feedSources.id, id));
  } catch (error: any) {
    console.error(`runFeedSourceSyncJob failed for source ${id}:`, error);
    await fail(`Đồng bộ thất bại: ${error?.message || String(error)}`);
  }
}

// Domains this source currently owns — via domain_categories.feedSourceId,
// the authoritative provenance link (set by addDomainCategoryMemberships on
// every insert/move, including ones that came through an approved review
// item — see resolveReviewItem). Shared by pause/resume/delete below.
async function getDomainIdsForFeedSource(feedSourceId: string): Promise<number[]> {
  const rows = await db
    .select({ domainId: domainCategories.domainId })
    .from(domainCategories)
    .where(eq(domainCategories.feedSourceId, feedSourceId));
  return rows.map((r) => r.domainId);
}

// Pauses a feed source: excludes it from future syncs (see
// startFeedSourceSync's isPaused guard and "Đồng bộ tất cả" in the
// frontend, which should skip paused sources) AND moves every domain it
// currently owns from active/grace_period to 'unblocked' — marked
// unblockedBySourcePause so resumeFeedSource can undo exactly this, and
// only this, later. Domains a human separately moved to allowlist/protected
// are left untouched (those are deliberate overrides, not "just being
// blocked because of this feed").
export async function pauseFeedSource(id: string, userEmail: string) {
  try {
    const existing = await db.select().from(feedSources).where(eq(feedSources.id, id)).limit(1);
    const source = existing[0];
    if (!source) throw new Error(`Feed source ${id} not found`);
    if (source.isPaused) return { source, affectedCount: 0 };

    const domainIds = await getDomainIdsForFeedSource(id);
    let affectedCount = 0;
    if (domainIds.length > 0) {
      const CHUNK = 5000;
      for (let i = 0; i < domainIds.length; i += CHUNK) {
        const chunk = domainIds.slice(i, i + CHUNK);
        const updated = await db
          .update(domains)
          .set({ status: 'unblocked', unblockedBySourcePause: true, updatedAt: new Date() })
          .where(and(inArray(domains.id, chunk), inArray(domains.status, ['active', 'grace_period'])))
          .returning({ id: domains.id });
        affectedCount += updated.length;
      }
    }

    const updatedSource = await db
      .update(feedSources)
      .set({ isPaused: true, updatedAt: new Date() })
      .where(eq(feedSources.id, id))
      .returning();

    await db.insert(auditLogs).values({
      user: userEmail,
      role: 'Admin',
      action: 'bulk_action',
      targetCount: affectedCount,
      summary: `Tạm dừng nguồn feed "${source.name}" — ${affectedCount.toLocaleString('vi-VN')} tên miền chuyển sang Thôi chặn`,
      reason: 'Tạm dừng đồng bộ nguồn feed',
      canRollback: false,
      details: [`Nguồn: ${source.name} (${id})`, `Số tên miền: ${affectedCount}`],
    });

    return { source: updatedSource[0], affectedCount };
  } catch (error) {
    console.error('pauseFeedSource failed:', error);
    throw error instanceof Error ? error : new Error('Failed to pause feed source', { cause: error });
  }
}

// Reverses exactly what pauseFeedSource did: re-activates every domain this
// source owns that is STILL 'unblocked' with unblockedBySourcePause = true
// (i.e. untouched by any human action since the pause — see updateDomain/
// bulkUpdateDomains clearing that flag on any explicit status change).
export async function resumeFeedSource(id: string, userEmail: string) {
  try {
    const existing = await db.select().from(feedSources).where(eq(feedSources.id, id)).limit(1);
    const source = existing[0];
    if (!source) throw new Error(`Feed source ${id} not found`);
    if (!source.isPaused) return { source, affectedCount: 0 };

    const domainIds = await getDomainIdsForFeedSource(id);
    let affectedCount = 0;
    if (domainIds.length > 0) {
      const CHUNK = 5000;
      for (let i = 0; i < domainIds.length; i += CHUNK) {
        const chunk = domainIds.slice(i, i + CHUNK);
        const updated = await db
          .update(domains)
          .set({ status: 'active', unblockedBySourcePause: false, updatedAt: new Date() })
          .where(and(inArray(domains.id, chunk), eq(domains.status, 'unblocked'), eq(domains.unblockedBySourcePause, true)))
          .returning({ id: domains.id });
        affectedCount += updated.length;
      }
    }

    const updatedSource = await db
      .update(feedSources)
      .set({ isPaused: false, updatedAt: new Date() })
      .where(eq(feedSources.id, id))
      .returning();

    await db.insert(auditLogs).values({
      user: userEmail,
      role: 'Admin',
      action: 'bulk_action',
      targetCount: affectedCount,
      summary: `Tiếp tục nguồn feed "${source.name}" — ${affectedCount.toLocaleString('vi-VN')} tên miền chuyển lại Đang chặn`,
      reason: 'Tiếp tục đồng bộ nguồn feed',
      canRollback: false,
      details: [`Nguồn: ${source.name} (${id})`, `Số tên miền: ${affectedCount}`],
    });

    return { source: updatedSource[0], affectedCount };
  } catch (error) {
    console.error('resumeFeedSource failed:', error);
    throw error instanceof Error ? error : new Error('Failed to resume feed source', { cause: error });
  }
}

// Deletes a feed source permanently. Unlike a pause, there's no "resume"
// coming back for these domains, so they're moved to 'unblocked' WITHOUT
// the unblockedBySourcePause marker (nothing will ever auto-re-activate
// them again — a human has to deliberately re-block if that's wanted).
// domain_categories.feedSourceId/reviewQueue.feedSourceId both reference
// this row ON DELETE SET NULL, so those rows survive with the link cleared
// rather than being cascade-deleted.
export async function deleteFeedSource(id: string, userEmail: string) {
  try {
    const existing = await db.select().from(feedSources).where(eq(feedSources.id, id)).limit(1);
    const source = existing[0];
    if (!source) throw new Error(`Feed source ${id} not found`);

    const domainIds = await getDomainIdsForFeedSource(id);
    let affectedCount = 0;
    if (domainIds.length > 0) {
      const CHUNK = 5000;
      for (let i = 0; i < domainIds.length; i += CHUNK) {
        const chunk = domainIds.slice(i, i + CHUNK);
        const updated = await db
          .update(domains)
          .set({ status: 'unblocked', unblockedBySourcePause: false, updatedAt: new Date() })
          .where(and(inArray(domains.id, chunk), inArray(domains.status, ['active', 'grace_period'])))
          .returning({ id: domains.id });
        affectedCount += updated.length;
      }
    }

    await db.delete(feedSources).where(eq(feedSources.id, id));

    await db.insert(auditLogs).values({
      user: userEmail,
      role: 'Admin',
      action: 'remove',
      targetCount: affectedCount,
      summary: `Đã xoá nguồn feed "${source.name}" — ${affectedCount.toLocaleString('vi-VN')} tên miền chuyển sang Thôi chặn`,
      reason: 'Xoá nguồn feed',
      canRollback: false,
      details: [`Nguồn: ${source.name} (${id})`, `Số tên miền: ${affectedCount}`],
    });

    return { affectedCount };
  } catch (error) {
    console.error('deleteFeedSource failed:', error);
    throw error instanceof Error ? error : new Error('Failed to delete feed source', { cause: error });
  }
}

// Bulk-queues domains for manual review instead of auto-blocking them —
// used by requiresReview-flagged feed sources (see runFeedSourceSyncJob).
// Idempotent against domains already pending: re-syncing the same
// lower-confidence feed before its previous batch has been reviewed does
// not create duplicate pending rows.
async function bulkCreateReviewItems(data: {
  domains: string[];
  proposedCategory: string;
  reportedBy: string;
  reason: string;
  feedSourceId?: string;
  onChunkProgress?: (processed: number, total: number) => void | Promise<void>;
}) {
  const cleanDomains = Array.from(new Set(data.domains.map((d) => d.toLowerCase().trim()).filter(Boolean)));
  if (cleanDomains.length === 0) return { insertedCount: 0, skippedCount: 0 };

  const CHECK_CHUNK = 10_000;
  const alreadyPending = new Set<string>();
  for (let i = 0; i < cleanDomains.length; i += CHECK_CHUNK) {
    const chunk = cleanDomains.slice(i, i + CHECK_CHUNK);
    const rows = await db
      .select({ domain: reviewQueue.domain })
      .from(reviewQueue)
      .where(and(eq(reviewQueue.status, 'pending'), inArray(reviewQueue.domain, chunk)));
    for (const r of rows) alreadyPending.add(r.domain);
  }
  const toInsert = cleanDomains.filter((d) => !alreadyPending.has(d));
  if (toInsert.length === 0) return { insertedCount: 0, skippedCount: cleanDomains.length };

  const INSERT_CHUNK = 1000;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    const result = await db
      .insert(reviewQueue)
      .values(
        chunk.map((domain) => ({
          domain,
          proposedCategory: data.proposedCategory,
          reportedBy: data.reportedBy,
          feedSourceId: data.feedSourceId || null,
          reason: data.reason,
          // Honest "unconfirmed" defaults — no crawler/telemetry pipeline
          // exists to back a specific-looking threat score or query count.
          threatScore: 0.5,
          queryCount24h: 0,
          evidenceNotes: '',
        }))
      )
      .returning({ id: reviewQueue.id });
    inserted += result.length;
    await data.onChunkProgress?.(i + chunk.length, toInsert.length);
  }
  return { insertedCount: inserted, skippedCount: cleanDomains.length - toInsert.length };
}

// 6. Review Queue Queries & Mutations
export async function getReviewQueue(status: string = 'pending') {
  try {
    return await db
      .select()
      .from(reviewQueue)
      .where(eq(reviewQueue.status, status))
      .orderBy(desc(reviewQueue.threatScore));
  } catch (error) {
    console.error('getReviewQueue failed:', error);
    throw new Error('Failed to retrieve review queue', { cause: error });
  }
}

export async function resolveReviewItem(
  id: number,
  decision: 'approved' | 'rejected',
  reviewerEmail: string,
  categoryOverride?: string
) {
  try {
    const item = await db
      .update(reviewQueue)
      .set({
        status: decision,
        reviewedBy: reviewerEmail,
        reviewedAt: new Date(),
      })
      .where(eq(reviewQueue.id, id))
      .returning();

    if (decision === 'approved' && item[0]) {
      // Add directly to domains — respects the reviewer's category override
      // if they picked a different one than the AI/crawler's proposal.
      // feedSourceId carries the original feed's provenance through to the
      // resulting domain_categories row, when this item came from one (see
      // bulkCreateReviewItems), so pause/delete on that source still finds
      // this domain even though it went through review rather than being
      // auto-blocked directly.
      await createDomain({
        domain: item[0].domain,
        categories: [categoryOverride || item[0].proposedCategory],
        source: `Báo cáo: ${item[0].reportedBy}`,
        reason: item[0].reason,
        userEmail: reviewerEmail,
        feedSourceId: item[0].feedSourceId || undefined,
      });
    }

    return item[0];
  } catch (error) {
    console.error('resolveReviewItem failed:', error);
    throw new Error('Failed to resolve review item', { cause: error });
  }
}

// 7. Audit Logs Queries
export async function getAuditLogs() {
  try {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  } catch (error) {
    console.error('getAuditLogs failed:', error);
    throw new Error('Failed to retrieve audit logs', { cause: error });
  }
}

// 8. Releases Queries & Mutations
export async function getReleases() {
  try {
    return await db.select().from(releases).orderBy(desc(releases.createdAt));
  } catch (error) {
    console.error('getReleases failed:', error);
    throw new Error('Failed to retrieve releases', { cause: error });
  }
}

export async function deployRemainingRelease(version: string, userEmail?: string) {
  try {
    const updated = await db
      .update(releases)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(releases.version, version))
      .returning();
    if (!updated[0]) throw new Error(`Release ${version} not found`);

    await db.insert(auditLogs).values({
      user: userEmail || 'SecOps Pipeline Automation',
      role: 'Admin',
      action: 'release',
      targetCount: 1,
      summary: `Triển khai hoàn tất bản phát hành ${version} đến 100% node Edge`,
      reason: 'Deploy remaining nodes sau khi cổng an toàn được xử lý',
      canRollback: true,
      rollbackExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      details: [`Phiên bản: ${version}`],
    });

    return updated[0];
  } catch (error) {
    console.error('deployRemainingRelease failed:', error);
    throw new Error('Failed to deploy release', { cause: error });
  }
}

export async function overrideReleaseSafetyGate(version: string, userEmail: string, reason: string) {
  try {
    const existing = await db.select().from(releases).where(eq(releases.version, version)).limit(1);
    if (!existing[0]) throw new Error(`Release ${version} not found`);

    const updatedCategories = (existing[0].categories || []).map((c) =>
      c.safetyGate === 'failed' || c.safetyGate === 'warning' ? { ...c, safetyGate: 'passed' as const } : c
    );

    const updated = await db
      .update(releases)
      .set({
        categories: updatedCategories,
        status: 'staged',
        blockedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(releases.version, version))
      .returning();

    await db.insert(auditLogs).values({
      user: userEmail || 'Admin',
      role: 'Admin',
      action: 'release',
      targetCount: 1,
      summary: `Admin ghi đè cổng an toàn cho bản phát hành ${version}`,
      reason: reason || 'Ghi đè cổng an toàn (Admin Override)',
      canRollback: true,
      rollbackExpiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      details: [`Phiên bản: ${version}`, 'Ghi đè toàn bộ cổng an toàn chưa đạt (failed/warning) sang passed'],
    });

    return updated[0];
  } catch (error) {
    console.error('overrideReleaseSafetyGate failed:', error);
    throw new Error('Failed to override release safety gate', { cause: error });
  }
}

export async function rollbackRelease(version: string, userEmail: string, reason: string) {
  try {
    const updated = await db
      .update(releases)
      .set({ status: 'rolled_back', updatedAt: new Date() })
      .where(eq(releases.version, version))
      .returning();
    if (!updated[0]) throw new Error(`Release ${version} not found`);

    await db.insert(auditLogs).values({
      user: userEmail || 'Admin',
      role: 'Admin',
      action: 'rollback',
      targetCount: 1,
      summary: `Hoàn tác (rollback) bản phát hành ${version}`,
      reason: reason || 'Khôi phục do phát hiện bất thường sau canary',
      canRollback: false,
      details: [`Phiên bản: ${version}`],
    });

    return updated[0];
  } catch (error) {
    console.error('rollbackRelease failed:', error);
    throw new Error('Failed to rollback release', { cause: error });
  }
}
