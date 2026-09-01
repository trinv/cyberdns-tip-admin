import React, { useState, useMemo, useRef } from 'react';
import { DomainItem, CategoryInfo, DomainStatus, FeedSource, MANUAL_SOURCE_FILTER } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';
import {
  Search, X, Plus, Download, ShieldAlert,
  ArrowUpDown,
  Copy, Check, Filter,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  FileText, FileSpreadsheet, Database
} from 'lucide-react';

interface DomainTableProps {
  // Exactly the current server-side page for the active filters (see
  // refreshDomains in App.tsx) — this component no longer re-filters,
  // re-sorts, or re-slices it locally.
  domains: DomainItem[];
  isLoading?: boolean;
  categories: CategoryInfo[];
  selectedDomainIds: Set<string>;
  onToggleSelectDomain: (id: string) => void;
  onSelectAllDomains: (checked: boolean) => void;
  isAllSelectedOnPage: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sortField: 'domain' | 'firstSeen' | 'lastSeen';
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: 'domain' | 'firstSeen' | 'lastSeen', direction: 'asc' | 'desc') => void;
  activeDomainId: string | null;
  onSetActiveDomainId: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  onClearCategoryFilter: () => void;
  selectedTld: string;
  setSelectedTld: (tld: string) => void;
  // Real feed_sources.id (or MANUAL_SOURCE_FILTER) — see types.ts's own note.
  selectedSource: string;
  setSelectedSource: (source: string) => void;
  // The full, real list of feed sources (id + name) — NOT derived from the
  // current page's domains — backing the "Nguồn Feed" filter dropdown/pill
  // below, so it lists every actual source and filters by the authoritative
  // domain_categories.feedSourceId, not the stale domains.source label a
  // domain was first created with (see getDomains' own note in queries.ts).
  feedSources: FeedSource[];
  // Drives the bulk-action toolbar's 3rd button: while viewing the "Đã thôi
  // chặn" list specifically, offering "Thôi chặn..." again on domains
  // already unblocked doesn't make sense — swapped for "Chặn..." (re-block)
  // instead. Any other status filter (including 'all', where the page can
  // mix statuses) keeps the original "Thôi chặn...".
  selectedStatus: DomainStatus | 'all';
  onOpenBulkModal: (actionType: 'add_group' | 'allowlist' | 'unblock' | 'block') => void;
  onOpenExportModal: () => void;
  onQuickExportTxt: () => void;
  onQuickExportCsv: () => void;
  onSaveFilter: () => void;
  onOpenMobileFilters?: () => void;
}

export const DomainTable: React.FC<DomainTableProps> = ({
  domains,
  isLoading = false,
  categories,
  selectedDomainIds,
  onToggleSelectDomain,
  onSelectAllDomains,
  isAllSelectedOnPage,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  sortField,
  sortDirection,
  onSortChange,
  activeDomainId,
  onSetActiveDomainId,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  onClearCategoryFilter,
  selectedTld,
  setSelectedTld,
  selectedSource,
  setSelectedSource,
  feedSources,
  selectedStatus,
  onOpenBulkModal,
  onOpenExportModal,
  onQuickExportTxt,
  onQuickExportCsv,
  onSaveFilter,
  onOpenMobileFilters,
}) => {
  const [tldFilterOpen, setTldFilterOpen] = useState(false);
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const tldFilterRef = useRef<HTMLDivElement>(null);
  const sourceFilterRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(tldFilterRef, () => setTldFilterOpen(false), tldFilterOpen);
  useClickOutside(sourceFilterRef, () => setSourceFilterOpen(false), sourceFilterOpen);
  useClickOutside(exportMenuRef, () => setExportMenuOpen(false), exportMenuOpen);

  // Extract unique TLDs and sources for filter dropdowns. NOTE: derived only
  // from the currently loaded page, not the entire matching set — a proper
  // fix would be a dedicated "distinct TLDs/sources" endpoint; acceptable
  // simplification for now since these are just quick-filter suggestions.
  const availableTlds = useMemo(() => {
    const set = new Set<string>();
    domains.forEach((d) => set.add(d.tld));
    return Array.from(set).sort();
  }, [domains]);

  // Real name for the currently-selected feedSourceId (or the manual-filter
  // sentinel) — used by the pill below. Falls back to the raw id if a
  // source was deleted after being selected (rare, harmless).
  const selectedSourceLabel = useMemo(() => {
    if (selectedSource === MANUAL_SOURCE_FILTER) return 'Thủ công (không qua Feed)';
    return feedSources.find((s) => s.id === selectedSource)?.name || selectedSource;
  }, [selectedSource, feedSources]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const handleSortClick = (field: 'domain' | 'firstSeen' | 'lastSeen', defaultAsc: boolean) => {
    if (sortField === field) onSortChange(field, sortDirection === 'asc' ? 'desc' : 'asc');
    else onSortChange(field, defaultAsc ? 'asc' : 'desc');
  };

  const getCategoryBadgeClass = (catName: string) => {
    switch (catName) {
      case 'gambling':
        return 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/80';
      case 'malware-phishing':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80';
      case 'tracking-adware':
        return 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200/80 dark:border-cyan-800/80';
      case 'nsfw':
        return 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200/80 dark:border-pink-800/80';
      case 'social':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80';
      case 'crypto-scam':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const renderStatus = (status: DomainStatus) => {
    switch (status) {
      case 'active':
        return (
          <div className="flex items-center space-x-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>đang chặn</span>
          </div>
        );
      case 'protected':
        return (
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"></span>
            <span>protected – không chặn</span>
          </div>
        );
      case 'allowlist':
        return (
          <div className="flex items-center space-x-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 inline-flex">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>trong allowlist</span>
          </div>
        );
      case 'unblocked':
        return (
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 dark:text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            <span>đã thôi chặn</span>
          </div>
        );
    }
  };

  const handleCopy = (e: React.MouseEvent, domainName: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(domainName);
    setCopiedDomain(domainName);
    setTimeout(() => setCopiedDomain(null), 1500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8fafc] dark:bg-[#0B1120] overflow-hidden font-sans transition-colors">
      {/* Top Filter Bar (Search & Filter Pills) */}
      <div className="p-3 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Mobile Filter Toggle Button */}
          {onOpenMobileFilters && (
            <button
              onClick={onOpenMobileFilters}
              id="btn-mobile-filter-drawer"
              className="lg:hidden flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold cursor-pointer active-press"
              title="Mở danh mục & bộ lọc"
            >
              <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Lọc</span>
            </button>
          )}

          {/* Search Box */}
          <div className="relative flex items-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus-within:border-emerald-500 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-2 focus-within:ring-emerald-100 dark:focus-within:ring-emerald-950/60 rounded-xl px-3 py-1.5 text-xs flex-1 sm:w-72 sm:flex-initial transition-all">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm domain (nohu, hitclub, bet88...)"
              id="input-domain-search"
              className="bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none w-full font-mono text-xs"
            />
            <kbd className="text-xs text-slate-400 dark:text-slate-500 font-mono flex-shrink-0 ml-1 bg-slate-200/60 dark:bg-slate-700 px-1 py-0.5 rounded hidden sm:inline-block">
              ⌘K
            </kbd>
          </div>

          {/* Group Filter Pill */}
          {selectedCategory !== 'all' && (
            <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-semibold">
              <span>group: {selectedCategory}</span>
              <button
                onClick={onClearCategoryFilter}
                className="hover:text-emerald-900 dark:hover:text-emerald-100 p-0.5 rounded ml-1 cursor-pointer"
                title="Xóa lọc nhóm"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* TLD Filter Dropdown / Pill */}
          {selectedTld ? (
            <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-mono font-semibold">
              <span>tld: .{selectedTld}</span>
              <button
                onClick={() => setSelectedTld('')}
                className="hover:text-purple-900 dark:hover:text-purple-100 p-0.5 rounded ml-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={tldFilterRef}>
              <button
                onClick={() => setTldFilterOpen(!tldFilterOpen)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-3 h-3" />
                <span>TLD</span>
              </button>
              {tldFilterOpen && (
                <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-40 text-left">
                  <div className="px-3 py-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Lọc đuôi tên miền
                  </div>
                  {availableTlds.map((tld) => (
                    <button
                      key={tld}
                      onClick={() => {
                        setSelectedTld(tld);
                        setTldFilterOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 hover:text-purple-700 dark:hover:text-purple-300 font-mono flex items-center justify-between text-left cursor-pointer"
                    >
                      <span>.{tld}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {domains.filter((d) => d.tld === tld).length}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Source Filter Dropdown / Pill — filters by the REAL, live
              domain_categories.feedSourceId (via feedSources, the actual
              nguồn cấp dữ liệu list), not the frozen domains.source label a
              domain happened to be created with. See types.ts's note on
              MANUAL_SOURCE_FILTER and getDomains' own note in queries.ts. */}
          {selectedSource ? (
            <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-mono font-semibold">
              <span>nguồn: {selectedSourceLabel}</span>
              <button
                onClick={() => setSelectedSource('')}
                className="hover:text-cyan-900 dark:hover:text-cyan-100 p-0.5 rounded ml-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={sourceFilterRef}>
              <button
                onClick={() => setSourceFilterOpen(!sourceFilterOpen)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-3 h-3" />
                <span>Nguồn Feed</span>
              </button>
              {sourceFilterOpen && (
                <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-40 text-left max-h-80 overflow-y-auto">
                  <div className="px-3 py-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Lọc theo nguồn feed (thực tế đang gán)
                  </div>
                  {feedSources.map((fs) => (
                    <button
                      key={fs.id}
                      onClick={() => {
                        setSelectedSource(fs.id);
                        setSourceFilterOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center justify-between text-left cursor-pointer"
                    >
                      <span className="truncate">{fs.name}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-2 flex-shrink-0">
                        {fs.domainCount.toLocaleString('vi-VN')}
                      </span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                  <button
                    onClick={() => {
                      setSelectedSource(MANUAL_SOURCE_FILTER);
                      setSourceFilterOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 hover:text-cyan-700 dark:hover:text-cyan-300 italic text-left cursor-pointer"
                  >
                    Thủ công (không qua Feed)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Save Filter Button */}
          <button
            onClick={onSaveFilter}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 font-semibold px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
          >
            Lưu bộ lọc
          </button>
        </div>

        {/* Export Dropdown Menu */}
        <div className="relative" ref={exportMenuRef}>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs active-press"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Xuất dữ liệu...</span>
            </button>
          </div>

          {exportMenuOpen && (
            <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-2 z-40 text-left animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3.5 py-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                TÙY CHỌN XUẤT NHANH
              </div>
              {/* Which scope "Xuất nhanh" below will actually use — nothing
                  ticked exports the whole filtered list; anything ticked
                  exports exactly that selection (see handleQuickExportTxt/
                  Csv in App.tsx). Spelled out here so it's never a silent
                  surprise which one you're about to get. */}
              <div
                className={`mx-3.5 mb-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                  selectedDomainIds.size > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                }`}
              >
                {selectedDomainIds.size > 0
                  ? `Sẽ xuất ${selectedDomainIds.size} tên miền đã chọn`
                  : 'Sẽ xuất toàn bộ danh sách đang lọc'}
              </div>
              <button
                onClick={() => {
                  onQuickExportTxt();
                  setExportMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center space-x-2.5 font-medium cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="font-bold">Xuất file .TXT (Danh sách Domain)</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">Một tên miền mỗi dòng (Feed/Script)</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onQuickExportCsv();
                  setExportMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-700 dark:hover:text-teal-300 flex items-center space-x-2.5 font-medium cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <div>
                  <div className="font-bold">Xuất file .CSV (Đầy đủ thuộc tính)</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">Bao gồm nhóm, trạng thái, nguồn và mốc thời gian</div>
                </div>
              </button>

              <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>

              <button
                onClick={() => {
                  onOpenExportModal();
                  setExportMenuOpen(false);
                }}
                className="w-full px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/50 hover:text-purple-700 dark:hover:text-purple-300 flex items-center space-x-2.5 font-bold cursor-pointer"
              >
                <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <div>Hộp thoại đa định dạng nâng cao...</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-normal">Hỗ trợ .HOSTS, RPZ Zone, AdBlock, Dnsmasq</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Bar (When domains are selected) */}
      {selectedDomainIds.size > 0 && (
        <div className="bg-emerald-50/90 dark:bg-slate-800 border-b border-emerald-200/80 dark:border-slate-700 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center space-x-2.5 text-slate-800 dark:text-slate-200 font-medium">
            <input
              type="checkbox"
              checked={isAllSelectedOnPage}
              onChange={(e) => onSelectAllDomains(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-600"
            />
            <span className="font-bold text-emerald-950 dark:text-emerald-300">
              Đã chọn {selectedDomainIds.size} / {domains.length} dòng trên trang này
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onOpenBulkModal('add_group')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs cursor-pointer active-press"
            >
              Thêm vào nhóm...
            </button>
            <button
              onClick={() => onOpenBulkModal('allowlist')}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold rounded-xl transition-colors cursor-pointer shadow-xs active-press"
            >
              Allowlist...
            </button>
            {selectedStatus === 'unblocked' ? (
              <button
                onClick={() => onOpenBulkModal('block')}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold rounded-xl transition-colors cursor-pointer shadow-xs active-press"
              >
                Chặn...
              </button>
            ) : (
              <button
                onClick={() => onOpenBulkModal('unblock')}
                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold rounded-xl transition-colors cursor-pointer shadow-xs active-press"
              >
                Thôi chặn...
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table Content */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-3 sm:p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-colors">
          <table className="w-full text-left text-xs border-collapse min-w-[750px]">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 sticky top-0 z-20 select-none">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelectedOnPage}
                    onChange={(e) => onSelectAllDomains(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-600"
                  />
                </th>
                <th
                  onClick={() => handleSortClick('domain', true)}
                  className="px-4 py-3 text-slate-700 dark:text-slate-300 font-bold cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>TÊN MIỀN (DOMAIN)</span>
                    {sortField === 'domain' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-slate-500 dark:text-slate-400">NHÓM DANH MỤC</th>
                <th className="px-4 py-3 text-slate-500 dark:text-slate-400">NGUỒN FEED</th>
                <th className="px-4 py-3 text-slate-500 dark:text-slate-400">TRẠNG THÁI</th>
                <th
                  onClick={() => handleSortClick('firstSeen', false)}
                  className="px-4 py-3 text-slate-500 dark:text-slate-400 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  <div className="flex items-center space-x-1">
                    <span>THẤY LẦN ĐẦU</span>
                    {sortField === 'firstSeen' && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {domains.map((item) => {
                const isSelected = selectedDomainIds.has(item.id);
                const isActive = activeDomainId === item.id;

                return (
                  <tr
                    key={item.id}
                    onClick={() => onSetActiveDomainId(item.id)}
                    className={`group transition-colors cursor-pointer relative ${
                      isActive
                        ? 'bg-emerald-50/60 dark:bg-slate-800 font-medium'
                        : isSelected
                        ? 'bg-emerald-50/30 dark:bg-slate-800/60'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Active row emerald bar indicator */}
                    <td
                      className="px-4 py-3 text-center relative"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelectDomain(item.id);
                      }}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 rounded-r"></span>
                      )}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-600"
                      />
                    </td>

                    {/* Domain Name */}
                    <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {item.domain}
                        </span>
                        <button
                          onClick={(e) => handleCopy(e, item.domain)}
                          title="Sao chép tên miền"
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-0.5 rounded transition-opacity"
                        >
                          {copiedDomain === item.domain ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Categories Pills */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {item.categories.map((cat) => (
                          <span
                            key={cat}
                            className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${getCategoryBadgeClass(
                              cat
                            )}`}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400 font-medium">
                      {item.source}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderStatus(item.status)}
                    </td>

                    {/* First Seen */}
                    <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {item.firstSeen}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty / loading state */}
          {domains.length === 0 && (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
              <ShieldAlert className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                {isLoading ? 'Đang tải...' : 'Không tìm thấy tên miền nào khớp bộ lọc'}
              </p>
              {!isLoading && (
                <p className="text-xs text-slate-400 dark:text-slate-500">Hãy thử đổi từ khóa tìm kiếm hoặc bỏ chọn các điều kiện lọc</p>
              )}
            </div>
          )}

          {/* Pagination Footer — reflects the real server-side total, not
              just what happens to be loaded on this page. */}
          {domains.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center space-x-3">
                <span>
                  Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)}</span> trên <span className="font-bold text-slate-800 dark:text-slate-200">{totalCount.toLocaleString('vi-VN')}</span> kết quả
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Số dòng/trang:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value={15}>15 dòng</option>
                    <option value={25}>25 dòng</option>
                    <option value={50}>50 dòng</option>
                    <option value={100}>100 dòng</option>
                  </select>
                </div>
              </div>

              {/* Page navigation buttons */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => onPageChange(1)}
                  disabled={page === 1}
                  title="Trang đầu"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  title="Trang trước"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Trang {page} / {totalPages}
                </div>

                <button
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  title="Trang tiếp"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onPageChange(totalPages)}
                  disabled={page === totalPages}
                  title="Trang cuối"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar & Shortcuts */}
      <div className="px-5 py-2 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 select-none shadow-xs transition-colors">
        <div className="flex items-center space-x-2">
          <span>Tổng số khớp bộ lọc: <strong className="text-slate-800 dark:text-slate-200 font-mono">{totalCount.toLocaleString('vi-VN')}</strong></span>
        </div>

        <div className="hidden md:flex items-center space-x-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
          <div className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold">
              j
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold">
              k
            </kbd>
            <span className="ml-0.5">di chuyển</span>
          </div>
          <div className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold">
              x
            </kbd>
            <span className="ml-0.5">chọn</span>
          </div>
          <div className="flex items-center space-x-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold">
              ⌘Z
            </kbd>
            <span className="ml-0.5">hoàn tác</span>
          </div>
        </div>
      </div>
    </div>
  );
};
