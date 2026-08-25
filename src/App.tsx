import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DomainItem, CategoryInfo, FeedSource, ReleaseItem, AuditLog, ReviewDomainItem, SavedFilter, DomainStatus, DashboardStats, AppUser } from './types';
import {
  fetchDashboardStats,
  fetchCategories,
  fetchDomains,
  fetchFeedSources,
  fetchReleases,
  fetchAuditLogs,
  fetchReviewQueue,
  createDomainApi,
  updateDomainApi,
  bulkImportDomainsApi,
  bulkActionDomainsApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
  createFeedSourceApi,
  syncFeedSourceApi,
  deployReleaseApi,
  overrideReleaseApi,
  rollbackReleaseApi,
  resolveReviewItemApi,
  loginApi,
  logoutApi,
  fetchMe,
  getStoredToken,
  setStoredToken,
  fetchUsers,
  createUserApi,
  updateUserApi,
  setUnauthorizedHandler,
} from './lib/api';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SidebarFilters } from './components/DomainExplorer/SidebarFilters';
import { DomainTable } from './components/DomainExplorer/DomainTable';
import { DomainInspector } from './components/DomainExplorer/DomainInspector';
import { DomainBulkModal } from './components/DomainExplorer/DomainBulkModal';
import { DashboardView } from './components/Dashboard/DashboardView';
import { ReleasesView } from './components/Releases/ReleasesView';
import { ImportView } from './components/Import/ImportView';
import { ReviewQueueView } from './components/ReviewQueue/ReviewQueueView';
import { SourcesView } from './components/Sources/SourcesView';
import { AuditLogsView } from './components/AuditLogs/AuditLogsView';
import { AddEditDomainModal } from './components/Modals/AddEditDomainModal';
import { CategoryManagerModal } from './components/Modals/CategoryManagerModal';
import { CrawlEvidenceModal } from './components/Modals/CrawlEvidenceModal';
import { DiffViewerModal } from './components/Modals/DiffViewerModal';
import { KeyboardShortcutsModal } from './components/Modals/KeyboardShortcutsModal';
import { ExportModal } from './components/Modals/ExportModal';
import { LoginModal } from './components/Modals/LoginModal';
import { UserManagementView } from './components/Users/UserManagementView';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Auth & Role State — self-hosted email/password accounts (see
  // src/middleware/auth.ts). userRole is derived from the logged-in
  // account's real role, never chosen client-side; defaults to the
  // least-privileged 'Analyst' while signed out.
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const userRole: 'Analyst' | 'Admin' | 'Reviewer' = currentUser?.role || 'Analyst';

  // "Unreleased changes" would mean diffing the current domain set against
  // the last release — there is no release-generation pipeline yet (see
  // ReleasesView's empty state), so there's nothing real to compute this
  // from. 0 (not a fake placeholder count) until that pipeline exists.
  const unreleasedCount = 0;

  const handleLogin = async (email: string, password: string) => {
    const { token, user } = await loginApi(email, password); // lets the modal show the real error on failure
    setStoredToken(token);
    setCurrentUser(user);
    setIsLoginModalOpen(false);
    showToast(`Đăng nhập thành công — xin chào ${user.displayName || user.email}!`, 'success');
  };

  const handleLogout = async () => {
    logoutApi().catch(() => {}); // best-effort server-side session delete
    setStoredToken(null);
    setCurrentUser(null);
    showToast('Đã đăng xuất.', 'info');
  };

  useEffect(() => {
    // Centralize "not signed in" / "insufficient role" handling for every
    // mutating API call, instead of every individual handler branching on it.
    // Most handlers still show their own toast in the catch block after
    // falling back to a local-only update (e.g. "Đã cập nhật... (ngoại
    // tuyến)") — deferring THIS toast to a macrotask (setTimeout 0) lets it
    // always run after those synchronous/microtask toasts, so the user sees
    // the real reason (not signed in) rather than a misleading success toast.
    setUnauthorizedHandler((status) => {
      setTimeout(() => {
        showToast(
          status === 401
            ? 'Vui lòng đăng nhập để thao tác này được lưu vào PostgreSQL.'
            : 'Tài khoản của bạn không có quyền thực hiện thao tác này.',
          'warning'
        );
      }, 0);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Restore session from a stored token on first load (page refresh).
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsAuthLoading(false);
      return;
    }
    fetchMe()
      .then((user) => setCurrentUser(user))
      .catch(() => setStoredToken(null)) // expired/invalid token
      .finally(() => setIsAuthLoading(false));
  }, []);

  // User management (Admin-only) — loaded lazily only when that tab is
  // actually open, since GET /api/users 403s for anyone else anyway.
  useEffect(() => {
    if (currentTab === 'users' && userRole === 'Admin') {
      fetchUsers()
        .then(setManagedUsers)
        .catch((err) => console.warn('fetchUsers notice:', err));
    }
  }, [currentTab, userRole]);

  const handleCreateUser = async (data: { email: string; password: string; displayName?: string; role?: string }) => {
    try {
      const created = await createUserApi(data);
      setManagedUsers((prev) => [created, ...prev]);
      showToast(`Đã tạo tài khoản ${created.email}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Tạo tài khoản thất bại.', 'warning');
    }
  };

  const handleUpdateUser = async (
    id: number,
    patch: { role?: string; isActive?: boolean; displayName?: string; password?: string }
  ) => {
    try {
      const updated = await updateUserApi(id, patch);
      setManagedUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      if (updated.id === currentUser?.id) setCurrentUser(updated);
      showToast(
        patch.isActive === false
          ? `Đã thu hồi tài khoản ${updated.email}`
          : `Đã cập nhật tài khoản ${updated.email}`,
        patch.isActive === false ? 'warning' : 'success'
      );
    } catch (err: any) {
      // Surfaces the last-active-admin guard message (see updateUserAccount
      // in queries.ts) and any other server-side rejection verbatim.
      showToast(err?.message || 'Cập nhật tài khoản thất bại.', 'warning');
    }
  };

  // Sidebar Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cyberdns_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Dark Mode Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cyberdns_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('cyberdns_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('cyberdns_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Main Data States — all start empty; real content only ever comes from
  // the backend now (see the removed seedInitialDatabaseIfEmpty in
  // src/db/queries.ts). No mock fallback data is shown on load or on fetch
  // failure — an empty/error state is honest, a silently-faked one isn't.
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [domainsTotal, setDomainsTotal] = useState<number>(0);
  const [isDomainsLoading, setIsDomainsLoading] = useState<boolean>(true);
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [release, setRelease] = useState<ReleaseItem | null>(null);
  const [releasesList, setReleasesList] = useState<ReleaseItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewDomainItem[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [managedUsers, setManagedUsers] = useState<AppUser[]>([]);

  // Real per-status domain counts (drives the sidebar's "TRẠNG THÁI
  // BLOCKLIST" checklist) — null until stats have loaded at least once.
  const statusCountsMap = useMemo(() => {
    if (!dashboardStats) return null;
    const map: Partial<Record<DomainStatus, number>> = {};
    for (const s of dashboardStats.statusBreakdown) map[s.status as DomainStatus] = s.count;
    return map;
  }, [dashboardStats]);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTld, setSelectedTld] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [statusFilters, setStatusFilters] = useState<Record<DomainStatus, boolean>>({
    active: true,
    grace_period: false,
    unblocked: false,
    allowlist: false,
    protected: false,
  });
  const [activeSavedFilter, setActiveSavedFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Debounced so typing a search term doesn't fire a request per keystroke.
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Pagination & sort — Domain Explorer now shows a real server-side page of
  // whatever matches the current filters (previously: a fixed 200-row local
  // snapshot re-filtered client-side, which silently hid everything past
  // row 200 — see the review that flagged this).
  const [domainsPage, setDomainsPage] = useState<number>(1);
  const [domainsPageSize, setDomainsPageSize] = useState<number>(25);
  const [sortField, setSortField] = useState<'domain' | 'firstSeen' | 'lastSeen' | 'threatScore'>('lastSeen');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selection & Inspector States
  const [selectedDomainIds, setSelectedDomainIds] = useState<Set<string>>(new Set());
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);

  // Modals States
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState<boolean>(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [bulkActionType, setBulkActionType] = useState<'add_group' | 'remove_group' | 'allowlist' | 'unblock'>('add_group');
  const [isAddDomainModalOpen, setIsAddDomainModalOpen] = useState<boolean>(false);
  const [domainToEdit, setDomainToEdit] = useState<DomainItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isCrawlEvidenceModalOpen, setIsCrawlEvidenceModalOpen] = useState<boolean>(false);
  const [evidenceDomain, setEvidenceDomain] = useState<DomainItem | ReviewDomainItem | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load live dataset from PostgreSQL. Deliberately NO mock-data fallback on
  // failure (unlike earlier in this project's history) — if the backend is
  // unreachable, every section just shows its own empty/error state rather
  // than silently reverting to fake demo numbers that look real.
  const refreshAllData = useCallback(async () => {
    const [cats, srcList, relList, logsList, revsList, stats] = await Promise.all([
      fetchCategories().catch((e) => { console.warn('fetchCategories failed:', e); return null; }),
      fetchFeedSources().catch((e) => { console.warn('fetchFeedSources failed:', e); return null; }),
      fetchReleases().catch((e) => { console.warn('fetchReleases failed:', e); return null; }),
      fetchAuditLogs().catch((e) => { console.warn('fetchAuditLogs failed:', e); return null; }),
      fetchReviewQueue().catch((e) => { console.warn('fetchReviewQueue failed:', e); return null; }),
      fetchDashboardStats().catch((e) => { console.warn('fetchDashboardStats failed:', e); return null; }),
    ]);

    setDashboardStats(stats);
    if (cats) setCategories(cats);
    if (srcList) setSources(srcList);
    if (relList) {
      setReleasesList(relList);
      setRelease(relList[0] || null);
    }
    if (logsList) setAuditLogs(logsList);
    if (revsList) setReviewItems(revsList);
  }, []);

  // Domain Explorer's list is fetched separately from everything else: it's
  // the one view whose data must reflect the CURRENT filters/page/sort
  // server-side (a category can now genuinely hold tens of thousands of
  // real synced domains — a fixed client-side snapshot can't represent that).
  const refreshDomains = useCallback(async () => {
    setIsDomainsLoading(true);
    try {
      const activeStatuses = (Object.keys(statusFilters) as DomainStatus[]).filter((k) => statusFilters[k]);
      const res = await fetchDomains({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: activeStatuses.length > 0 ? activeStatuses.join(',') : undefined,
        tld: selectedTld || undefined,
        source: selectedSource || undefined,
        search: debouncedSearchQuery || undefined,
        limit: domainsPageSize,
        offset: (domainsPage - 1) * domainsPageSize,
        sortField,
        sortDirection,
      });
      setDomains(res.domains);
      setDomainsTotal(res.total);
    } catch (err) {
      console.warn('fetchDomains failed:', err);
      setDomains([]);
      setDomainsTotal(0);
    } finally {
      setIsDomainsLoading(false);
    }
  }, [selectedCategory, statusFilters, selectedTld, selectedSource, debouncedSearchQuery, domainsPage, domainsPageSize, sortField, sortDirection]);

  // Same filters as refreshDomains, but with no limit/offset — the backend
  // then returns every matching row instead of one page. Used by the Export
  // modal's "toàn bộ danh mục" scope and by the quick-export toolbar buttons
  // so exporting is never silently capped at whatever happens to be on
  // screen.
  const fetchAllFilteredDomains = useCallback(async (): Promise<DomainItem[]> => {
    const activeStatuses = (Object.keys(statusFilters) as DomainStatus[]).filter((k) => statusFilters[k]);
    const res = await fetchDomains({
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      status: activeStatuses.length > 0 ? activeStatuses.join(',') : undefined,
      tld: selectedTld || undefined,
      source: selectedSource || undefined,
      search: debouncedSearchQuery || undefined,
      sortField,
      sortDirection,
    });
    return res.domains;
  }, [selectedCategory, statusFilters, selectedTld, selectedSource, debouncedSearchQuery, sortField, sortDirection]);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  useEffect(() => {
    refreshDomains();
  }, [refreshDomains]);

  // Feed sync progress poll — lives at the App level (always mounted,
  // regardless of which tab is active) rather than inside SourcesView, so a
  // running sync's progress keeps updating even while the user is looking
  // at a different tab. Sync itself always runs server-side (see
  // startFeedSourceSync/runFeedSourceSyncJob in queries.ts); this effect
  // only polls GET /api/sources to reflect that real state — there is no
  // client-local "isSyncing" flag to lose on navigation.
  useEffect(() => {
    if (!sources.some((s) => s.status === 'syncing')) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const fresh = await fetchFeedSources();
        if (cancelled) return;
        let anyCompleted = false;
        for (const freshSrc of fresh) {
          const prev = sources.find((p) => p.id === freshSrc.id);
          if (prev?.status === 'syncing' && freshSrc.status !== 'syncing') {
            anyCompleted = true;
            if (freshSrc.status === 'error') {
              showToast(`Đồng bộ "${freshSrc.name}" thất bại: ${freshSrc.errorMessage || 'Lỗi không xác định'}`, 'warning');
            } else if (freshSrc.status === 'warning') {
              showToast(`Đồng bộ "${freshSrc.name}" hoàn tất kèm cảnh báo: ${freshSrc.errorMessage || ''}`, 'warning');
            } else {
              showToast(
                `Đồng bộ "${freshSrc.name}" hoàn tất — ${freshSrc.lastSyncMessage || `đã nạp ${freshSrc.domainCount.toLocaleString('vi-VN')} domain`}`,
                'success'
              );
            }
          }
        }
        setSources(fresh);
        if (anyCompleted) {
          await Promise.all([
            fetchCategories().then(setCategories).catch(() => {}),
            fetchDashboardStats().then(setDashboardStats).catch(() => {}),
            refreshDomains(),
          ]);
        }
      } catch (err) {
        console.warn('Poll feed sources failed:', err);
      }
    };
    const interval = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sources, refreshDomains]);

  // Any actual filter change (not just paging/sorting) invalidates the
  // current page/selection — jumping back to page 1 and clearing a
  // selection that may no longer even be on screen.
  useEffect(() => {
    setDomainsPage(1);
    setSelectedDomainIds(new Set());
    setActiveDomainId(null);
  }, [selectedCategory, statusFilters, selectedTld, selectedSource, debouncedSearchQuery]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (currentTab !== 'domain') setCurrentTab('domain');
        setTimeout(() => {
          document.getElementById('input-domain-search')?.focus();
        }, 50);
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsKeyboardHelpOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTab]);

  // `domains` is now already exactly the current filtered/sorted/paginated
  // server page (see refreshDomains above) — no client-side re-filtering.

  // Selected domain object for Inspector. Only looks within the currently
  // loaded page — if the inspected domain isn't on this page (e.g. the user
  // changed page/filter), the inspector naturally closes rather than
  // showing stale data.
  const activeDomain = useMemo(() => {
    if (!activeDomainId) return null;
    return domains.find((d) => d.id === activeDomainId) || null;
  }, [domains, activeDomainId]);

  // Toggle selection
  const handleToggleSelectDomain = (id: string) => {
    setSelectedDomainIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all / deselect all — scoped to the currently loaded page. Bulk
  // action across an entire multi-thousand-domain filtered set (not just
  // this page) would need a filter-based backend action rather than an ID
  // list; not implemented yet, so this deliberately doesn't claim to do that.
  const handleSelectAllDomains = (checked: boolean) => {
    setSelectedDomainIds(checked ? new Set(domains.map((d) => d.id)) : new Set());
  };

  const isAllSelectedOnPage = useMemo(() => {
    if (domains.length === 0) return false;
    return domains.every((d) => selectedDomainIds.has(d.id));
  }, [domains, selectedDomainIds]);

  // Status checkbox toggle
  const handleToggleStatus = (statusKey: DomainStatus) => {
    setStatusFilters((prev) => ({
      ...prev,
      [statusKey]: !prev[statusKey],
    }));
  };

  // Saved Filter select
  const handleSelectSavedFilter = (sf: SavedFilter) => {
    setActiveSavedFilter(sf.id);
    if (sf.category) setSelectedCategory(sf.category);
    if (sf.query) setSearchQuery(sf.query);
    if (sf.status) {
      setStatusFilters({
        active: sf.status === 'active',
        grace_period: sf.status === 'grace_period',
        unblocked: sf.status === 'unblocked',
        allowlist: sf.status === 'allowlist',
        protected: sf.status === 'protected',
      });
    }
    showToast(`Đã áp dụng bộ lọc: ${sf.name}`, 'info');
  };

  // Bulk Actions
  // NOTE: previously this received (reason, category) from DomainBulkModal
  // while declaring (action, targetCategories[], reason) — a real,
  // previously-undetected signature mismatch that meant NO bulk action ever
  // actually reached the backend correctly. Both sides are now aligned (see
  // DomainBulkModal.tsx's onConfirm type) and this trusts the real server
  // response instead of hand-simulating the result locally.
  const handleConfirmBulkAction = async (
    action: 'add_group' | 'remove_group' | 'allowlist' | 'unblock',
    targetCategories: string[],
    reason: string
  ) => {
    const selectedIdsArray: string[] = Array.from(selectedDomainIds);
    try {
      const result = await bulkActionDomainsApi({
        action,
        domainIds: selectedIdsArray,
        category: targetCategories[0],
        reason,
      });
      setSelectedDomainIds(new Set());
      await Promise.all([refreshDomains(), fetchAuditLogs().then(setAuditLogs).catch(() => {}), fetchCategories().then(setCategories).catch(() => {})]);
      const n = result.updatedCount;
      showToast(
        action === 'add_group' ? `Đã thêm nhóm vào ${n} tên miền!` :
        action === 'remove_group' ? `Đã gỡ nhóm khỏi ${n} tên miền!` :
        action === 'allowlist' ? `Đã chuyển ${n} tên miền vào Allowlist!` :
        `Đã gỡ chặn hoàn toàn cho ${n} tên miền!`,
        action === 'allowlist' ? 'warning' : 'success'
      );
    } catch (err: any) {
      console.warn('Backend bulk action notice:', err);
      showToast(err?.message || 'Thao tác hàng loạt thất bại — vui lòng thử lại.', 'warning');
    }
    setIsBulkModalOpen(false);
  };

  // Add / Edit Single Domain
  const handleSaveDomain = async (domainData: Partial<DomainItem>, reason?: string) => {
    if (domainToEdit) {
      const numericId = Number(domainToEdit.id);
      try {
        if (Number.isNaN(numericId)) throw new Error('Invalid domain id');
        await updateDomainApi(numericId, domainData, reason);
        showToast(`Đã cập nhật và lưu cấu hình cho ${domainData.domain} vào PostgreSQL`, 'success');
        await Promise.all([refreshDomains(), fetchCategories().then(setCategories).catch(() => {})]);
      } catch (err) {
        console.warn('Backend update domain notice:', err);
        showToast(`Không thể lưu thay đổi cho ${domainData.domain} — vui lòng thử lại.`, 'warning');
      }
    } else {
      // Create new
      try {
        const created = await createDomainApi({
          domain: domainData.domain || '',
          categories: domainData.categories || ['gambling'],
          reason: reason || 'Bổ sung IOC từ giao diện quản trị',
        });
        showToast(`Đã lưu tên miền mới vào PostgreSQL: ${created.domain}`, 'success');
        await Promise.all([refreshDomains(), fetchCategories().then(setCategories).catch(() => {})]);
      } catch (err) {
        console.warn('Backend create domain notice:', err);
        showToast(`Không thể lưu tên miền mới — vui lòng thử lại.`, 'warning');
      }
    }
    setIsAddDomainModalOpen(false);
  };

  // Single Quick Actions — refetch the current page afterward rather than
  // patching the row in place, since a status change can make it stop
  // matching the active status filter (e.g. unblocking while "active" is
  // the only checked status should make the row disappear).
  const handleUnblockSingle = async (domain: DomainItem) => {
    const numericId = Number(domain.id);
    try {
      if (Number.isNaN(numericId)) throw new Error('Invalid domain id');
      await updateDomainApi(numericId, { status: 'unblocked' }, 'Gỡ chặn thủ công từ giao diện quản trị');
      showToast(`Đã gỡ chặn tên miền ${domain.domain}`, 'info');
      await refreshDomains();
    } catch (err) {
      console.warn('Backend unblock notice:', err);
      showToast(`Không thể gỡ chặn ${domain.domain} — vui lòng thử lại.`, 'warning');
    }
  };

  const handleMoveToAllowlist = async (domain: DomainItem) => {
    const numericId = Number(domain.id);
    try {
      if (Number.isNaN(numericId)) throw new Error('Invalid domain id');
      await updateDomainApi(numericId, { status: 'allowlist' }, 'Chuyển vào Allowlist từ giao diện quản trị');
      showToast(`Đã chuyển ${domain.domain} vào danh sách cho phép (Allowlist)`, 'warning');
      await refreshDomains();
    } catch (err) {
      console.warn('Backend allowlist notice:', err);
      showToast(`Không thể chuyển ${domain.domain} vào Allowlist — vui lòng thử lại.`, 'warning');
    }
  };

  // Quick Plain Text (.txt) download — exports the current selection, or
  // otherwise EVERY domain matching the active filters (the whole category),
  // not just the page currently on screen.
  const handleQuickExportTxt = async () => {
    let targetList: DomainItem[];
    if (selectedDomainIds.size > 0) {
      targetList = domains.filter((d) => selectedDomainIds.has(d.id));
    } else {
      try {
        targetList = await fetchAllFilteredDomains();
      } catch (err) {
        showToast('Không thể tải toàn bộ danh sách để xuất — vui lòng thử lại.', 'warning');
        return;
      }
    }

    const content = targetList.map(d => d.domain).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberdns-domains-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${targetList.length} tên miền sang định dạng .TXT thành công!`, 'success');
  };

  // Quick CSV download — same "selection, or the whole filtered category" scope as above.
  const handleQuickExportCsv = async () => {
    let targetList: DomainItem[];
    if (selectedDomainIds.size > 0) {
      targetList = domains.filter((d) => selectedDomainIds.has(d.id));
    } else {
      try {
        targetList = await fetchAllFilteredDomains();
      } catch (err) {
        showToast('Không thể tải toàn bộ danh sách để xuất — vui lòng thử lại.', 'warning');
        return;
      }
    }

    const headers = ['domain', 'primaryCategory', 'categories', 'status', 'threatScore', 'source', 'firstSeen'];
    const rows = targetList.map(d => [
      d.domain,
      d.primaryCategory,
      `"${d.categories.join(';')}"`,
      d.status,
      d.threatScore ?? 0,
      d.source,
      d.firstSeen
    ].join(','));
    const content = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberdns-domains-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${targetList.length} tên miền sang file CSV!`, 'success');
  };

  // Import batch — persists the FULL list via one bulk-insert call
  // (POST /api/domains/bulk-import), not just the first N items.
  const handleImportDomains = async (domainsToImport: string[], category: string, reason: string) => {
    try {
      const result = await bulkImportDomainsApi({
        domains: domainsToImport,
        categories: [category],
        source: 'Nhập hàng loạt (Batch Import)',
        reason,
      });
      showToast(`Đã nhập và lưu thành công ${result.insertedCount} tên miền vào PostgreSQL!`, 'success');
      await Promise.all([refreshDomains(), fetchCategories().then(setCategories).catch(() => {})]);
    } catch (err) {
      console.warn('Backend bulk import notice:', err);
      showToast(`Nhập thất bại — chưa có tên miền nào được lưu. Vui lòng thử lại.`, 'warning');
    }
    setCurrentTab('domain');
  };

  // Review Queue actions — approving creates a real domain server-side (see
  // resolveReviewItem in queries.ts), so refetch rather than fabricate one
  // locally with placeholder ASN/age/timeline fields that were never real.
  const handleApproveReview = async (id: string, customCategory?: string) => {
    const item = reviewItems.find((r) => r.id === id);
    if (!item) return;
    try {
      await resolveReviewItemApi(id, 'approved', customCategory);
      setReviewItems((prev) => prev.filter((r) => r.id !== id));
      showToast(`Đã duyệt chặn tên miền ${item.domain} vào nhóm ${customCategory || item.proposedCategory}`, 'success');
      await Promise.all([refreshDomains(), fetchCategories().then(setCategories).catch(() => {})]);
    } catch (err) {
      console.warn('Backend resolve review notice:', err);
      showToast(`Duyệt thất bại cho ${item.domain} — vui lòng thử lại.`, 'warning');
    }
  };

  const handleRejectReview = async (id: string, reason: string) => {
    const item = reviewItems.find((r) => r.id === id);
    try {
      await resolveReviewItemApi(id, 'rejected');
      setReviewItems((prev) => prev.filter((r) => r.id !== id));
      showToast(`Đã từ chối tên miền ${item?.domain || ''} (${reason})`, 'info');
    } catch (err) {
      console.warn('Backend reject review notice:', err);
      showToast(`Từ chối thất bại cho ${item?.domain || ''} — vui lòng thử lại.`, 'warning');
    }
  };

  const handleApproveAllReviews = async () => {
    const items = reviewItems;
    const results = await Promise.allSettled(items.map((item) => resolveReviewItemApi(item.id, 'approved')));
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    // Refetch the queue rather than guess locally which items actually
    // resolved — the simplest way to stay correct if some calls failed.
    const freshQueue = await fetchReviewQueue().catch(() => null);
    if (freshQueue) setReviewItems(freshQueue);
    await Promise.all([refreshDomains(), fetchCategories().then(setCategories).catch(() => {})]);
    showToast(
      failed > 0
        ? `Đã duyệt ${succeeded}/${items.length} tên miền — ${failed} thất bại, vui lòng thử lại.`
        : `Đã duyệt ${succeeded} tên miền!`,
      failed > 0 ? 'warning' : 'success'
    );
  };

  // Rollback Transaction in Audit Log — NOTE: there is no backend endpoint
  // that actually reverses a logged action yet (each action type would need
  // its own "undo" logic — e.g. re-adding a removed category membership,
  // restoring a domain's prior status — and the audit log doesn't currently
  // store enough structured before/after state to do that generically).
  // Showing a fake "success" toast here would be exactly the kind of
  // simulated result this system moved away from, so this is honest about
  // not being implemented yet instead.
  const handleRollbackTransaction = (log: AuditLog) => {
    if (userRole !== 'Admin') {
      showToast('Chỉ tài khoản Admin mới có quyền thực hiện Hoàn tác giao dịch!', 'warning');
      return;
    }
    showToast(`Hoàn tác tự động cho giao dịch "${log.summary}" chưa được triển khai — vui lòng chỉnh sửa thủ công tại Domain Explorer nếu cần.`, 'warning');
  };

  // Release Canary Actions
  const applyReleaseUpdate = (updated: ReleaseItem) => {
    setRelease((prev) => ({ ...prev, ...updated }));
    setReleasesList((prev) => prev.map((r) => (r.version === updated.version ? { ...r, ...updated } : r)));
  };

  const handleDeployRemaining = async () => {
    if (!release) return;
    try {
      const updated = await deployReleaseApi(release.version);
      applyReleaseUpdate(updated);
      showToast(`Bản phát hành đã được triển khai hoàn tất 100% đến các node Edge Anycast!`, 'success');
    } catch (err: any) {
      console.warn('Backend deploy release notice:', err);
      showToast(err?.message || 'Triển khai thất bại — vui lòng thử lại.', 'warning');
    }
  };

  const handleAdminOverride = async () => {
    if (!release) return;
    if (userRole !== 'Admin') {
      showToast(`Cần quyền Admin để ghi đè cổng an toàn! Vui lòng chuyển role sang Admin ở góc trên bên phải.`, 'warning');
      return;
    }
    try {
      const updated = await overrideReleaseApi(release.version, 'Admin ghi đè cổng an toàn từ giao diện Phát hành');
      applyReleaseUpdate(updated);
      showToast(`Admin đã ghi đè thành công cổng an toàn! Bắt đầu cuốn chiếu toàn bộ cụm.`, 'success');
    } catch (err: any) {
      console.warn('Backend override release notice:', err);
      showToast(err?.message || 'Ghi đè thất bại — vui lòng thử lại.', 'warning');
    }
  };

  const handleRollbackRelease = async (version: string) => {
    try {
      const updated = await rollbackReleaseApi(version, 'Khôi phục thủ công từ giao diện Phát hành');
      applyReleaseUpdate(updated);
      showToast(`Đã hoàn tác và khôi phục về bản phát hành ${version}`, 'success');
    } catch (err: any) {
      console.warn('Backend rollback release notice:', err);
      showToast(err?.message || 'Hoàn tác thất bại — vui lòng thử lại.', 'warning');
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 flex flex-row font-sans selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:text-emerald-300">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-14 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-bold border ${
            toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' :
            toast.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200' :
            'bg-blue-50 dark:bg-blue-950/90 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="hover:text-slate-900 dark:hover:text-white ml-2 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Global Sidebar (Left Navigation) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        reviewCount={reviewItems.length}
        unreleasedCount={unreleasedCount}
        totalDomainCount={dashboardStats?.totalActive ?? 0}
        sourcesCount={sources.length}
        currentUser={currentUser}
        userRole={userRole}
        isDarkMode={isDarkMode}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenAddDomain={() => {
          setDomainToEdit(null);
          setIsAddDomainModalOpen(true);
        }}
        onOpenSearch={() => {
          if (currentTab !== 'domain') setCurrentTab('domain');
          setTimeout(() => document.getElementById('input-domain-search')?.focus(), 50);
        }}
        onOpenShortcuts={() => setIsKeyboardHelpOpen(true)}
      />

      {/* Right Column: Topbar (Header) + Main Content View */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50 dark:bg-[#0B1120]">
        {/* Global Topbar Header */}
        <Header
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenSearch={() => {
            if (currentTab !== 'domain') setCurrentTab('domain');
            setTimeout(() => document.getElementById('input-domain-search')?.focus(), 50);
          }}
          reviewCount={reviewItems.length}
          currentUser={currentUser}
          userRole={userRole}
          isAuthLoading={isAuthLoading}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onSignOut={handleLogout}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
              setIsMobileSidebarOpen(!isMobileSidebarOpen);
            } else {
              toggleSidebarCollapse();
            }
          }}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {/* TAB 1: DOMAIN EXPLORER */}
          {currentTab === 'domain' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Category & Filter Sidebar */}
              <SidebarFilters
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                statusFilters={statusFilters}
                onToggleStatus={handleToggleStatus}
                savedFilters={savedFilters}
                activeSavedFilter={activeSavedFilter}
                onSelectSavedFilter={handleSelectSavedFilter}
                onOpenAddCategory={() => setIsCategoryModalOpen(true)}
                onSaveCurrentFilter={() => showToast('Đã lưu bộ lọc tìm kiếm hiện tại vào danh sách!', 'info')}
                totalDomainCount={dashboardStats?.totalActive ?? 0}
                statusCounts={statusCountsMap}
                isOpenMobile={isMobileFiltersOpen}
                onCloseMobile={() => setIsMobileFiltersOpen(false)}
              />

              {/* Middle Data Table */}
              <DomainTable
                domains={domains}
                isLoading={isDomainsLoading}
                categories={categories}
                selectedDomainIds={selectedDomainIds}
                onToggleSelectDomain={handleToggleSelectDomain}
                onSelectAllDomains={handleSelectAllDomains}
                isAllSelectedOnPage={isAllSelectedOnPage}
                page={domainsPage}
                pageSize={domainsPageSize}
                totalCount={domainsTotal}
                onPageChange={setDomainsPage}
                onPageSizeChange={(size) => { setDomainsPageSize(size); setDomainsPage(1); }}
                sortField={sortField}
                sortDirection={sortDirection}
                onSortChange={(field, direction) => { setSortField(field); setSortDirection(direction); }}
                activeDomainId={activeDomainId}
                onSetActiveDomainId={setActiveDomainId}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedCategory={selectedCategory}
                onClearCategoryFilter={() => setSelectedCategory('all')}
                selectedTld={selectedTld}
                setSelectedTld={setSelectedTld}
                selectedSource={selectedSource}
                setSelectedSource={setSelectedSource}
                onOpenBulkModal={(actionType) => {
                  setBulkActionType(actionType);
                  setIsBulkModalOpen(true);
                }}
                onOpenExportModal={() => setIsExportModalOpen(true)}
                onQuickExportTxt={handleQuickExportTxt}
                onQuickExportCsv={handleQuickExportCsv}
                onEditDomain={(d) => {
                  setDomainToEdit(d);
                  setIsAddDomainModalOpen(true);
                }}
                onUnblockSingle={handleUnblockSingle}
                onMoveToAllowlistSingle={handleMoveToAllowlist}
                onViewEvidence={(d) => {
                  setEvidenceDomain(d);
                  setIsCrawlEvidenceModalOpen(true);
                }}
                onSaveFilter={() => showToast('Đã lưu bộ lọc tìm kiếm hiện tại vào danh sách!', 'info')}
                onOpenMobileFilters={() => setIsMobileFiltersOpen(true)}
              />

              {/* Right Domain Inspector Drawer */}
              <DomainInspector
                domain={activeDomain}
                categories={categories}
                onClose={() => setActiveDomainId(null)}
                onEditGroup={(d) => {
                  setDomainToEdit(d);
                  setIsAddDomainModalOpen(true);
                }}
                onAddToAllowlist={handleMoveToAllowlist}
                onViewEvidence={(d) => {
                  setEvidenceDomain(d);
                  setIsCrawlEvidenceModalOpen(true);
                }}
                onUnblock={handleUnblockSingle}
              />
            </div>
          )}

          {/* TAB 2: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigateToTab={setCurrentTab}
              sources={sources}
              categories={categories}
              reviewItems={reviewItems}
              stats={dashboardStats}
              onOpenReleaseAlert={() => setCurrentTab('release')}
              onOpenCrawlerAlert={() => setCurrentTab('sources')}
              onOpenAllowlistAlert={() => {
                setCurrentTab('domain');
                setStatusFilters((prev) => ({ ...prev, allowlist: true }));
              }}
              unreleasedCount={unreleasedCount}
              onOpenDiff={() => setIsDiffModalOpen(true)}
              onOpenRelease={() => setCurrentTab('release')}
            />
          )}

          {/* TAB 3: NHẬP (Batch Import & Parser) */}
          {currentTab === 'import' && (
            <ImportView
              categories={categories}
              onImportDomains={handleImportDomains}
            />
          )}

          {/* TAB 4: DUYỆT (Review Queue) */}
          {currentTab === 'review' && (
            <ReviewQueueView
              items={reviewItems}
              categories={categories}
              onApprove={handleApproveReview}
              onReject={handleRejectReview}
              onApproveAll={handleApproveAllReviews}
              onViewScreenshot={(item) => {
                setEvidenceDomain(item);
                setIsCrawlEvidenceModalOpen(true);
              }}
            />
          )}

          {/* TAB 5: PHÁT HÀNH (Releases & Safety Gates) */}
          {currentTab === 'release' && (
            <ReleasesView
              release={release}
              releases={releasesList}
              userRole={userRole}
              onDeployRemaining={handleDeployRemaining}
              onAdminOverride={handleAdminOverride}
              onRollbackRelease={handleRollbackRelease}
              onViewDomainsList={(cat) => {
                setSelectedCategory(cat);
                setCurrentTab('domain');
              }}
            />
          )}

          {/* TAB 6: NGUỒN (Feed Sources) */}
          {currentTab === 'sources' && (
            <SourcesView
              sources={sources}
              categories={categories}
              // Sync is fire-and-forget on the server (see startFeedSourceSync
              // in queries.ts) — this call only starts the job and flips the
              // source to 'syncing' with real progress; the polling effect
              // above picks up progress/completion from then on, so this
              // keeps working correctly even if the user switches tabs
              // immediately after clicking.
              onSyncAll={async () => {
                try {
                  const started = await Promise.all(
                    sources.map((s) =>
                      syncFeedSourceApi(s.id).catch((e) => {
                        console.warn(`Bắt đầu đồng bộ nguồn ${s.id} thất bại:`, e);
                        return null;
                      })
                    )
                  );
                  setSources((prev) => prev.map((s) => started.find((u) => u?.id === s.id) || s));
                  const failedToStart = started.filter((r) => !r).length;
                  showToast(
                    failedToStart > 0
                      ? `Đã bắt đầu đồng bộ — ${failedToStart} nguồn không khởi động được, xem chi tiết ở từng thẻ.`
                      : `Đã bắt đầu đồng bộ ${sources.length} nguồn feed — tiến trình sẽ cập nhật trực tiếp trên từng thẻ.`,
                    failedToStart > 0 ? 'warning' : 'info'
                  );
                } catch (err) {
                  console.warn('Backend sync-all sources notice:', err);
                  showToast('Không thể bắt đầu đồng bộ — vui lòng thử lại.', 'warning');
                }
              }}
              onSyncSingle={async (id) => {
                try {
                  const started = await syncFeedSourceApi(id);
                  setSources((prev) => prev.map((s) => (s.id === id ? started : s)));
                  showToast(`Đã bắt đầu đồng bộ "${started.name}" — tiến trình sẽ cập nhật trực tiếp trên thẻ nguồn.`, 'info');
                } catch (err) {
                  console.warn('Backend sync source notice:', err);
                  showToast('Không thể bắt đầu đồng bộ — vui lòng thử lại.', 'warning');
                }
              }}
              onAddSource={async (newSrc) => {
                // Only reflect the source locally once PostgreSQL actually
                // has it — a fake local row (with a made-up domainCount and
                // "just synced" timestamp) on failure would misrepresent a
                // source that doesn't really exist yet.
                try {
                  const created = await createFeedSourceApi(newSrc);
                  setSources((prev) => [...prev, created]);
                  showToast(`Đã thêm nguồn feed ${created.name} (đã lưu vào PostgreSQL) — bấm "Đồng bộ" để nạp dữ liệu.`);
                } catch (err: any) {
                  console.warn('Backend create source notice:', err);
                  showToast(err?.message || `Không thể thêm nguồn feed "${newSrc.name}" — vui lòng thử lại.`, 'warning');
                }
              }}
            />
          )}

          {/* TAB 7: NHẬT KÝ (Audit Logs & Rollback) */}
          {currentTab === 'logs' && (
            <AuditLogsView
              logs={auditLogs}
              onRollbackTransaction={handleRollbackTransaction}
            />
          )}

          {/* TAB 8: NGƯỜI DÙNG (User Management — Admin only) */}
          {currentTab === 'users' && (
            userRole === 'Admin' ? (
              <UserManagementView
                users={managedUsers}
                currentUserId={currentUser?.id ?? null}
                onCreateUser={handleCreateUser}
                onUpdateUser={handleUpdateUser}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                Chỉ tài khoản Admin mới có quyền truy cập trang quản lý người dùng.
              </div>
            )
          )}
        </main>
      </div>

      {/* Global Modals */}
      <DomainBulkModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        actionType={bulkActionType}
        selectedDomains={domains.filter((d) => selectedDomainIds.has(d.id))}
        categories={categories}
        onConfirm={handleConfirmBulkAction}
      />

      <AddEditDomainModal
        isOpen={isAddDomainModalOpen}
        onClose={() => setIsAddDomainModalOpen(false)}
        domainToEdit={domainToEdit}
        categories={categories}
        onSave={handleSaveDomain}
      />

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onAddCategory={async (cat) => {
          // Only reflect the category locally once PostgreSQL actually has
          // it — a fake success toast + fake local row on failure would
          // show a category the DB doesn't have (the exact kind of
          // simulated data this system moved away from).
          try {
            const created = await createCategoryApi(cat);
            setCategories((prev) => [...prev, created]);
            showToast(`Đã tạo nhóm danh mục mới: ${created.name} (đã lưu vào PostgreSQL)`);
          } catch (err: any) {
            console.warn('Backend create category notice:', err);
            showToast(err?.message || `Không thể tạo nhóm danh mục "${cat.name}" — vui lòng thử lại.`, 'warning');
          }
        }}
        onUpdateCategory={async (id, patch) => {
          try {
            const updated = await updateCategoryApi(id, patch);
            setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
            showToast(`Đã cập nhật nhóm danh mục ${id}`);
          } catch (err: any) {
            console.warn('Backend update category notice:', err);
            showToast(err?.message || `Không thể cập nhật nhóm danh mục ${id} — vui lòng thử lại.`, 'warning');
          }
        }}
        onDeleteCategory={async (id) => {
          try {
            await deleteCategoryApi(id);
            setCategories((prev) => prev.filter((c) => c.id !== id));
            showToast(`Đã xóa nhóm danh mục ${id}`, 'warning');
          } catch (err: any) {
            console.warn('Backend delete category notice:', err);
            showToast(err?.message || `Không thể xóa nhóm danh mục ${id} — vui lòng thử lại.`, 'warning');
          }
        }}
      />

      <CrawlEvidenceModal
        isOpen={isCrawlEvidenceModalOpen}
        onClose={() => setIsCrawlEvidenceModalOpen(false)}
        domain={evidenceDomain}
      />

      <DiffViewerModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        release={release}
      />

      <KeyboardShortcutsModal
        isOpen={isKeyboardHelpOpen}
        onClose={() => setIsKeyboardHelpOpen(false)}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedCount={selectedDomainIds.size}
        selectedDomains={domains.filter((d) => selectedDomainIds.has(d.id))}
        activeCategory={selectedCategory}
        totalFilteredCount={domainsTotal}
        fetchAllFilteredDomains={fetchAllFilteredDomains}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
      />
    </div>
  );
}
