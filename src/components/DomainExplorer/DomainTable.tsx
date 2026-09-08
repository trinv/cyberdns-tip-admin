import React, { useState, useMemo, useRef } from 'react';
import { DomainItem, CategoryInfo, DomainStatus, FeedSource, MANUAL_SOURCE_FILTER } from '../../types';
import { useClickOutside } from '../../hooks/useClickOutside';
import { copyToClipboard } from '../../lib/clipboard';
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

  // Real color assigned to the category in Category Manager (same field
  // Sidebar/Dashboard already use) — not a hardcoded name→color map, so a
  // newly-created category always renders correctly without needing a code
  // change here.
  const getCategoryColor = (catId: string) => categories.find((c) => c.id === catId)?.color || '#64748b';

  const renderStatus = (status: DomainStatus) => {
    switch (status) {
      case 'active':
        // Green, not the app's primary blue — a status signal ("blocking is
        // actively working"), distinct from primary/brand actions.
        return (
          <div className="d-flex align-items-center gap-2 small">
            <span className="rounded-circle bg-success" style={{ width: 8, height: 8 }} />
            <span>đang chặn</span>
          </div>
        );
      case 'protected':
        return (
          <div className="d-flex align-items-center gap-2 small text-body-secondary">
            <span className="rounded-circle bg-secondary" style={{ width: 8, height: 8 }} />
            <span>protected – không chặn</span>
          </div>
        );
      case 'allowlist':
        // Same reasoning as 'active' above — a positive/allowed STATUS.
        return <span className="badge rounded-pill text-bg-success-subtle text-success">trong allowlist</span>;
      case 'unblocked':
        return (
          <div className="d-flex align-items-center gap-2 small text-body-secondary">
            <span className="rounded-circle bg-secondary-subtle" style={{ width: 8, height: 8 }} />
            <span>đã thôi chặn</span>
          </div>
        );
    }
  };

  const handleCopy = async (e: React.MouseEvent, domainName: string) => {
    e.stopPropagation();
    // Only show the "copied" checkmark once the copy actually succeeded —
    // see copyToClipboard's own note on why the old unconditional
    // navigator.clipboard.writeText call could silently do nothing (no
    // HTTPS/secure context) while still claiming success.
    const ok = await copyToClipboard(domainName);
    if (ok) {
      setCopiedDomain(domainName);
      setTimeout(() => setCopiedDomain(null), 1500);
    }
  };

  return (
    <div className="flex-grow-1 d-flex flex-column h-100 bg-body overflow-hidden">
      {/* Top Filter Bar (Search & Filter Pills) */}
      <div className="p-3 border-bottom bg-body d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1" style={{ minWidth: 280 }}>
          {/* Mobile Filter Toggle Button */}
          {onOpenMobileFilters && (
            <button
              onClick={onOpenMobileFilters}
              id="btn-mobile-filter-drawer"
              className="d-lg-none btn btn-light btn-sm border d-flex align-items-center gap-2"
              title="Mở danh mục & bộ lọc"
            >
              <Filter size={14} className="text-primary" />
              <span>Lọc</span>
            </button>
          )}

          {/* Search Box */}
          <div className="input-group input-group-sm flex-grow-1" style={{ maxWidth: 288 }}>
            <span className="input-group-text bg-body">
              <Search size={14} className="text-body-secondary" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm domain (nohu, hitclub, bet88...)"
              id="input-domain-search"
              className="form-control font-monospace"
            />
          </div>

          {/* Group Filter Pill */}
          {selectedCategory !== 'all' && (
            <span className="badge rounded-pill text-bg-primary-subtle text-primary d-flex align-items-center gap-2 font-monospace fw-normal">
              <span>group: {selectedCategory}</span>
              <button onClick={onClearCategoryFilter} title="Xóa lọc nhóm" className="btn-close btn-close-sm" style={{ fontSize: '0.55rem' }} />
            </span>
          )}

          {/* TLD Filter Dropdown / Pill */}
          {selectedTld ? (
            <span className="badge rounded-pill text-bg-secondary-subtle d-flex align-items-center gap-2 font-monospace fw-normal">
              <span>tld: .{selectedTld}</span>
              <button onClick={() => setSelectedTld('')} className="btn-close btn-close-sm" style={{ fontSize: '0.55rem' }} />
            </span>
          ) : (
            <div className="position-relative" ref={tldFilterRef}>
              <button onClick={() => setTldFilterOpen(!tldFilterOpen)} className="btn btn-light btn-sm border d-flex align-items-center gap-1">
                <Plus size={12} />
                <span>TLD</span>
              </button>
              {tldFilterOpen && (
                <div className="dropdown-menu show mt-1" style={{ width: 176 }}>
                  <div className="px-3 py-1 small text-uppercase text-body-secondary fw-bold">Lọc đuôi tên miền</div>
                  {availableTlds.map((tld) => (
                    <button
                      key={tld}
                      onClick={() => { setSelectedTld(tld); setTldFilterOpen(false); }}
                      className="dropdown-item d-flex align-items-center justify-content-between font-monospace small"
                    >
                      <span>.{tld}</span>
                      <span className="text-body-secondary">{domains.filter((d) => d.tld === tld).length}</span>
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
            <span className="badge rounded-pill text-bg-info-subtle text-info d-flex align-items-center gap-2 font-monospace fw-normal">
              <span>nguồn: {selectedSourceLabel}</span>
              <button onClick={() => setSelectedSource('')} className="btn-close btn-close-sm" style={{ fontSize: '0.55rem' }} />
            </span>
          ) : (
            <div className="position-relative" ref={sourceFilterRef}>
              <button onClick={() => setSourceFilterOpen(!sourceFilterOpen)} className="btn btn-light btn-sm border d-flex align-items-center gap-1">
                <Plus size={12} />
                <span>Nguồn Feed</span>
              </button>
              {sourceFilterOpen && (
                <div className="dropdown-menu show mt-1" style={{ width: 256, maxHeight: 320, overflowY: 'auto' }}>
                  <div className="px-3 py-1 small text-uppercase text-body-secondary fw-bold">Lọc theo nguồn feed (thực tế đang gán)</div>
                  {feedSources.map((fs) => (
                    <button
                      key={fs.id}
                      onClick={() => { setSelectedSource(fs.id); setSourceFilterOpen(false); }}
                      className="dropdown-item d-flex align-items-center justify-content-between small"
                    >
                      <span className="text-truncate">{fs.name}</span>
                      <span className="text-body-secondary ms-2 flex-shrink-0">{fs.domainCount.toLocaleString('vi-VN')}</span>
                    </button>
                  ))}
                  <div className="dropdown-divider" />
                  <button
                    onClick={() => { setSelectedSource(MANUAL_SOURCE_FILTER); setSourceFilterOpen(false); }}
                    className="dropdown-item small fst-italic text-body-secondary"
                  >
                    Thủ công (không qua Feed)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Save Filter Button */}
          <button onClick={onSaveFilter} className="btn btn-link btn-sm text-decoration-none">
            Lưu bộ lọc
          </button>
        </div>

        {/* Export Dropdown Menu */}
        <div className="position-relative" ref={exportMenuRef}>
          <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="btn btn-light btn-sm border d-flex align-items-center gap-2">
            <Download size={14} className="text-primary" />
            <span>Xuất dữ liệu...</span>
          </button>

          {exportMenuOpen && (
            <div className="dropdown-menu show mt-1" style={{ width: 288, right: 0, left: 'auto' }}>
              <div className="px-3 py-1 small text-uppercase text-body-secondary fw-bold">Tùy chọn xuất nhanh</div>
              {/* Which scope "Xuất nhanh" below will actually use — nothing
                  ticked exports the whole filtered list; anything ticked
                  exports exactly that selection (see handleQuickExportTxt/
                  Csv in App.tsx). Spelled out here so it's never a silent
                  surprise which one you're about to get. */}
              <div className={`mx-3 mb-2 px-2 py-2 rounded-2 small fw-semibold ${selectedDomainIds.size > 0 ? 'text-bg-success-subtle text-success' : 'text-bg-secondary-subtle text-secondary'}`}>
                {selectedDomainIds.size > 0 ? `Sẽ xuất ${selectedDomainIds.size} tên miền đã chọn` : 'Sẽ xuất toàn bộ danh sách đang lọc'}
              </div>
              <button onClick={() => { onQuickExportTxt(); setExportMenuOpen(false); }} className="dropdown-item d-flex align-items-start gap-2">
                <FileText size={16} className="text-primary mt-1 flex-shrink-0" />
                <div>
                  <div className="fw-bold small">Xuất file .TXT (Danh sách Domain)</div>
                  <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Một tên miền mỗi dòng (Feed/Script)</div>
                </div>
              </button>
              <button onClick={() => { onQuickExportCsv(); setExportMenuOpen(false); }} className="dropdown-item d-flex align-items-start gap-2">
                <FileSpreadsheet size={16} className="text-info mt-1 flex-shrink-0" />
                <div>
                  <div className="fw-bold small">Xuất file .CSV (Đầy đủ thuộc tính)</div>
                  <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Bao gồm nhóm, trạng thái, nguồn và mốc thời gian</div>
                </div>
              </button>
              <div className="dropdown-divider" />
              <button onClick={() => { onOpenExportModal(); setExportMenuOpen(false); }} className="dropdown-item d-flex align-items-start gap-2">
                <Database size={16} className="mt-1 flex-shrink-0" style={{ color: 'var(--bs-purple, #6f42c1)' }} />
                <div>
                  <div className="fw-bold small">Hộp thoại đa định dạng nâng cao...</div>
                  <div className="text-body-secondary" style={{ fontSize: '0.75rem' }}>Hỗ trợ .HOSTS, RPZ Zone, AdBlock, Dnsmasq</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Bar (When domains are selected) */}
      {selectedDomainIds.size > 0 && (
        <div className="bg-primary-subtle border-bottom px-4 py-2 d-flex flex-wrap align-items-center justify-content-between gap-3 small">
          <div className="d-flex align-items-center gap-2 fw-medium">
            <input
              type="checkbox"
              checked={isAllSelectedOnPage}
              onChange={(e) => onSelectAllDomains(e.target.checked)}
              className="form-check-input m-0"
            />
            <span className="fw-bold text-primary-emphasis">
              Đã chọn {selectedDomainIds.size} / {domains.length} dòng trên trang này
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button onClick={() => onOpenBulkModal('add_group')} className="btn btn-primary btn-sm">Thêm vào nhóm...</button>
            <button onClick={() => onOpenBulkModal('allowlist')} className="btn btn-outline-info btn-sm">Allowlist...</button>
            {selectedStatus === 'unblocked' ? (
              <button onClick={() => onOpenBulkModal('block')} className="btn btn-outline-success btn-sm">Chặn...</button>
            ) : (
              <button onClick={() => onOpenBulkModal('unblock')} className="btn btn-outline-danger btn-sm">Thôi chặn...</button>
            )}
          </div>
        </div>
      )}

      {/* Main Table Content */}
      <div className="flex-grow-1 overflow-auto p-3">
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ minWidth: 750 }}>
              <thead className="sticky-top bg-body-tertiary" style={{ zIndex: 2 }}>
                <tr className="small">
                  <th style={{ width: 48 }} className="text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelectedOnPage}
                      onChange={(e) => onSelectAllDomains(e.target.checked)}
                      className="form-check-input m-0"
                    />
                  </th>
                  <th onClick={() => handleSortClick('domain', true)} role="button">
                    <div className="d-flex align-items-center gap-1">
                      <span>Tên miền (Domain)</span>
                      {sortField === 'domain' ? (
                        <span className="text-primary font-monospace">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      ) : (
                        <ArrowUpDown size={12} className="text-body-secondary" />
                      )}
                    </div>
                  </th>
                  <th>Nhóm danh mục</th>
                  <th>Nguồn feed</th>
                  <th>Trạng thái</th>
                  <th onClick={() => handleSortClick('firstSeen', false)} role="button">
                    <div className="d-flex align-items-center gap-1">
                      <span>Thấy lần đầu</span>
                      {sortField === 'firstSeen' && (
                        <span className="text-primary font-monospace">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="small">
                {domains.map((item) => {
                  const isSelected = selectedDomainIds.has(item.id);
                  return (
                    <tr key={item.id} className={isSelected ? 'table-active' : ''}>
                      <td className="text-center" onClick={() => onToggleSelectDomain(item.id)} style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="form-check-input m-0" />
                      </td>

                      {/* Domain Name */}
                      <td className="font-monospace">
                        <div className="d-flex align-items-center gap-2">
                          <span className="fw-bold">{item.domain}</span>
                          <button
                            onClick={(e) => handleCopy(e, item.domain)}
                            title="Sao chép tên miền"
                            className="btn btn-link btn-sm p-0 text-body-secondary"
                          >
                            {copiedDomain === item.domain ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>

                      {/* Categories Pills — real category color, not a
                          hardcoded name→color map (see getCategoryColor). */}
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {item.categories.map((cat) => {
                            const color = getCategoryColor(cat);
                            return (
                              <span
                                key={cat}
                                className="badge rounded-pill fw-semibold"
                                style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
                              >
                                {cat}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="font-monospace text-body-secondary">{item.source}</td>

                      {/* Status */}
                      <td className="text-nowrap">{renderStatus(item.status)}</td>

                      {/* First Seen */}
                      <td className="font-monospace text-body-secondary text-nowrap">{item.firstSeen}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Empty / loading state */}
            {domains.length === 0 && (
              <div className="text-center py-5 text-body-secondary">
                <ShieldAlert size={32} className="mx-auto mb-2 text-body-tertiary" />
                <p className="fw-semibold mb-1">{isLoading ? 'Đang tải...' : 'Không tìm thấy tên miền nào khớp bộ lọc'}</p>
                {!isLoading && <p className="small mb-0">Hãy thử đổi từ khóa tìm kiếm hoặc bỏ chọn các điều kiện lọc</p>}
              </div>
            )}
          </div>

          {/* Pagination Footer — reflects the real server-side total, not
              just what happens to be loaded on this page. */}
          {domains.length > 0 && (
            <div className="card-footer bg-body-tertiary d-flex flex-wrap align-items-center justify-content-between gap-3 small">
              <div className="d-flex align-items-center gap-3">
                <span>
                  Hiển thị <strong>{(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)}</strong> trên{' '}
                  <strong>{totalCount.toLocaleString('vi-VN')}</strong> kết quả
                </span>
                <div className="d-flex align-items-center gap-2">
                  <span className="text-body-secondary">Số dòng/trang:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="form-select form-select-sm"
                    style={{ width: 'auto' }}
                  >
                    <option value={15}>15 dòng</option>
                    <option value={25}>25 dòng</option>
                    <option value={50}>50 dòng</option>
                    <option value={100}>100 dòng</option>
                  </select>
                </div>
              </div>

              {/* Page navigation — real Bootstrap pagination component */}
              <nav>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => onPageChange(1)} title="Trang đầu"><ChevronsLeft size={14} /></button>
                  </li>
                  <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => onPageChange(Math.max(1, page - 1))} title="Trang trước"><ChevronLeft size={14} /></button>
                  </li>
                  <li className="page-item disabled">
                    <span className="page-link font-monospace">Trang {page} / {totalPages}</span>
                  </li>
                  <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => onPageChange(Math.min(totalPages, page + 1))} title="Trang tiếp"><ChevronRight size={14} /></button>
                  </li>
                  <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => onPageChange(totalPages)} title="Trang cuối"><ChevronsRight size={14} /></button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Bar & Shortcuts */}
      <div className="px-4 py-2 bg-body border-top d-flex flex-wrap align-items-center justify-content-between text-body-secondary small">
        <div>
          <span>Tổng số khớp bộ lọc: <strong className="font-monospace">{totalCount.toLocaleString('vi-VN')}</strong></span>
        </div>

        <div className="d-none d-md-flex align-items-center gap-3 font-monospace">
          <div className="d-flex align-items-center gap-1">
            <kbd>j</kbd>
            <kbd>k</kbd>
            <span className="ms-1">di chuyển</span>
          </div>
          <div className="d-flex align-items-center gap-1">
            <kbd>x</kbd>
            <span className="ms-1">chọn</span>
          </div>
          <div className="d-flex align-items-center gap-1">
            <kbd>⌘Z</kbd>
            <span className="ms-1">hoàn tác</span>
          </div>
        </div>
      </div>
    </div>
  );
};
