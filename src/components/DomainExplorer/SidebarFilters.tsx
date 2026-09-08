import React from 'react';
import { CategoryInfo, SavedFilter, DomainStatus } from '../../types';
import { Plus, Bookmark, Filter, X } from 'lucide-react';

const STATUS_OPTIONS: { value: DomainStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang chặn' },
  { value: 'unblocked', label: 'Đã thôi chặn' },
  { value: 'allowlist', label: 'Trong allowlist' },
];

interface SidebarFiltersProps {
  categories: CategoryInfo[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  selectedStatus: DomainStatus | 'all';
  onSelectStatus: (status: DomainStatus | 'all') => void;
  savedFilters: SavedFilter[];
  activeSavedFilter: string | null;
  onSelectSavedFilter: (filter: SavedFilter) => void;
  onOpenAddCategory: () => void;
  onSaveCurrentFilter: () => void;
  // Real count across EVERY status AND every category (dashboardStats.
  // totalAll) — always global, regardless of which category is currently
  // selected. Backs ONLY the CATEGORY section's "Tất cả nhóm" badge. Each
  // category's own badge (cat.count, below) is also all-status — so "Tất
  // cả nhóm" and an individual category's count are directly comparable
  // (the whole is never smaller than one of its parts).
  allCategoriesCount: number;
  // Real count across every status, SCOPED to whichever category is
  // currently selected (or the same as allCategoriesCount when 'all' is
  // selected) — backs ONLY the STATUS section's own "Tất cả" badge.
  allStatusCount: number;
  // Real per-status counts, SCOPED the same way as allStatusCount above —
  // undefined/null while stats haven't loaded yet for the current category,
  // rendered as "…" rather than a guessed number.
  statusCounts: Partial<Record<DomainStatus, number>> | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedStatus,
  onSelectStatus,
  savedFilters,
  activeSavedFilter,
  onSelectSavedFilter,
  onOpenAddCategory,
  onSaveCurrentFilter,
  allCategoriesCount,
  allStatusCount,
  statusCounts,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const formatNumber = (num: number) => num.toLocaleString('vi-VN');
  const formatStatusCount = (status: DomainStatus) => {
    const n = statusCounts?.[status];
    return n === undefined ? '…' : formatNumber(n);
  };

  const content = (
    <div className="d-flex flex-column h-100 overflow-y-auto p-3 gap-4" style={{ fontSize: '0.8125rem' }}>
      {/* Mobile close bar */}
      <div className="d-lg-none d-flex align-items-center justify-content-between pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2 fw-bold">
          <Filter size={16} className="text-primary" />
          <span>Bộ lọc &amp; Danh mục</span>
        </div>
        <button onClick={onCloseMobile} className="app-header-icon-btn" style={{ width: 28, height: 28 }}>
          <X size={16} />
        </button>
      </div>

      {/* CATEGORY SECTION */}
      <div>
        <div className="app-nav-group-label d-flex align-items-center justify-content-between mt-0">
          <span>Nhóm danh mục (Category)</span>
          <button onClick={onOpenAddCategory} title="Thêm nhóm mới" className="btn btn-link btn-sm p-0 text-secondary">
            <Plus size={14} />
          </button>
        </div>

        <div className="d-flex flex-column gap-1">
          {/* Tất cả */}
          <button
            onClick={() => { onSelectCategory('all'); if (onCloseMobile) onCloseMobile(); }}
            className={`app-filter-link ${selectedCategory === 'all' ? 'is-active' : ''}`}
          >
            <span className="d-flex align-items-center gap-2 text-truncate">
              <span className="rounded-circle bg-secondary flex-shrink-0" style={{ width: 10, height: 10 }} />
              <span className="text-truncate">Tất cả nhóm</span>
            </span>
            <span className="app-filter-count">{formatNumber(allCategoriesCount)}</span>
          </button>

          {/* Categories list */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { onSelectCategory(cat.id); if (onCloseMobile) onCloseMobile(); }}
                className={`app-filter-link ${isSelected ? 'is-active' : ''} ${cat.count === 0 && !isSelected ? 'is-muted' : ''}`}
              >
                <span className="d-flex align-items-center gap-2 text-truncate">
                  <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: cat.color }} />
                  <span className="text-truncate">{cat.name}</span>
                </span>
                <span className="app-filter-count">{formatNumber(cat.count)}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onOpenAddCategory}
          className="btn btn-outline-secondary btn-sm w-100 mt-2 d-flex align-items-center justify-content-center gap-2"
          style={{ borderStyle: 'dashed' }}
        >
          <Plus size={14} />
          <span>Thêm nhóm mới</span>
        </button>
      </div>

      {/* TRẠNG THÁI SECTION — real Bootstrap form-switch toggles, one row
          per status. selectedStatus is still one single value (never
          independent booleans), so switching any one ON always visually
          turns the other three OFF as a side effect — there is no way to
          end up with zero or multiple switches lit at once, by
          construction (checked is derived, never stored per-switch). */}
      <div>
        <div className="app-nav-group-label">Trạng thái blocklist</div>
        <div className="d-flex flex-column gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const isOn = selectedStatus === opt.value;
            return (
              <label
                key={opt.value}
                className={`app-filter-link ${isOn ? 'is-active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <span className="d-flex flex-column text-truncate">
                  <span className="text-truncate">{opt.label}</span>
                  <span className="font-monospace text-body-secondary" style={{ fontSize: '0.75rem' }}>
                    {opt.value === 'all' ? formatNumber(allStatusCount) : formatStatusCount(opt.value)}
                  </span>
                </span>
                <span className="form-check form-switch flex-shrink-0 m-0">
                  <input
                    type="checkbox"
                    role="switch"
                    className="form-check-input"
                    checked={isOn}
                    onChange={() => { onSelectStatus(opt.value); if (onCloseMobile) onCloseMobile(); }}
                    style={{ width: 34, height: 18 }}
                  />
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* BỘ LỌC ĐÃ LƯU SECTION */}
      <div>
        <div className="app-nav-group-label d-flex align-items-center justify-content-between">
          <span>Bộ lọc đã lưu</span>
          <button onClick={onSaveCurrentFilter} title="Lưu bộ lọc" className="btn btn-link btn-sm p-0 text-secondary">
            <Bookmark size={14} />
          </button>
        </div>

        <div className="d-flex flex-column gap-1">
          {savedFilters.map((sf) => {
            const isFilterActive = activeSavedFilter === sf.id;
            return (
              <button
                key={sf.id}
                onClick={() => { onSelectSavedFilter(sf); if (onCloseMobile) onCloseMobile(); }}
                className={`app-filter-link ${isFilterActive ? 'is-active' : ''}`}
              >
                <span className="text-truncate">{sf.name}</span>
                <span className="app-filter-count">{sf.count}</span>
              </button>
            );
          })}
        </div>

        <button onClick={onSaveCurrentFilter} className="btn btn-link btn-sm text-decoration-none d-flex align-items-center gap-2 mt-1 px-0">
          <Plus size={14} />
          <span>Lưu bộ lọc hiện tại</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer */}
      {isOpenMobile && (
        <>
          <div
            onClick={onCloseMobile}
            className="d-lg-none position-fixed top-0 start-0 end-0 bottom-0 bg-dark bg-opacity-75"
            style={{ zIndex: 1039 }}
          />
          <div className="d-lg-none position-fixed top-0 bottom-0 start-0 bg-body shadow-lg border-end d-flex flex-column" style={{ width: 288, zIndex: 1040 }}>
            {content}
          </div>
        </>
      )}

      {/* Desktop Fixed Left Pane */}
      <aside className="d-none d-lg-flex flex-shrink-0 bg-body border-end flex-column h-100" style={{ width: 256 }}>
        {content}
      </aside>
    </>
  );
};
