import React from 'react';
import { CategoryInfo, SavedFilter, DomainStatus } from '../../types';
import { Plus, Tag, Bookmark, CheckSquare, Square, FolderPlus, Sparkles, Filter, X } from 'lucide-react';

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
  // Real count across EVERY status (dashboardStats.totalAll) — shared by
  // BOTH the CATEGORY section's "Tất cả nhóm" and the STATUS section's
  // "Tất cả", deliberately the same number in both places. Each category's
  // own badge (cat.count, below) is also all-status — so "Tất cả nhóm" and
  // an individual category's count are directly comparable (the whole is
  // never smaller than one of its parts). This used to be two different
  // props — "Tất cả nhóm" wired to an ACTIVE-ONLY count while every
  // category badge next to it was all-status — which could show a single
  // category with a HIGHER count than "Tất cả nhóm" itself: a real,
  // reported "the total is less than one part" confusion.
  allStatusCount: number;
  // Real per-status counts from GET /api/dashboard/stats — undefined/null
  // while stats haven't loaded yet, rendered as "…" rather than a guessed
  // number.
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
    <div className="flex flex-col h-full overflow-y-auto select-none p-4 space-y-6 text-xs scrollbar-thin">
      {/* Mobile close bar */}
      <div className="lg:hidden flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2 font-bold text-slate-800 dark:text-white text-sm">
          <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Bộ lọc & Danh mục</span>
        </div>
        <button
          onClick={onCloseMobile}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* CATEGORY SECTION */}
      <div>
        <div className="flex items-center justify-between px-2 mb-2.5 text-slate-400 dark:text-slate-500 font-bold tracking-wider text-xs uppercase">
          <span className="flex items-center space-x-1.5">
            <span>NHÓM DANH MỤC (CATEGORY)</span>
          </span>
          <button
            onClick={onOpenAddCategory}
            title="Thêm nhóm mới"
            className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5 rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {/* Tất cả */}
          <button
            onClick={() => {
              onSelectCategory('all');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center space-x-2.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
              <span className="truncate">Tất cả nhóm</span>
            </div>
            <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
              selectedCategory === 'all' 
                ? 'bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold' 
                : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800'
            }`}>
              {formatNumber(allStatusCount)}
            </span>
          </button>

          {/* Categories list */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  onSelectCategory(cat.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                } ${
                  // A still-empty category (created but never synced/filled)
                  // recedes visually so the eye lands on groups that actually
                  // have domains — it stays fully legible and clickable,
                  // just quieter, and never dims while it's the active filter.
                  cat.count === 0 && !isSelected ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs"
                    style={{ backgroundColor: cat.color }}
                  ></span>
                  <span className="truncate">{cat.name}</span>
                </div>
                <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                  isSelected 
                    ? 'bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold' 
                    : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800'
                }`}>
                  {formatNumber(cat.count)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onOpenAddCategory}
          className="w-full mt-2.5 px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm nhóm mới</span>
        </button>
      </div>

      {/* TRẠNG THÁI SECTION — single-select toggle group (was a dropdown)
          matching how a saved filter/category selection already only ever
          carries ONE status at a time. */}
      <div>
        <div className="px-2 mb-2.5 text-slate-400 dark:text-slate-500 font-bold tracking-wider text-xs uppercase">
          TRẠNG THÁI BLOCKLIST
        </div>
        <div className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
          {STATUS_OPTIONS.map((opt, idx) => {
            const isSelected = selectedStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectStatus(opt.value);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                  idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                } ${
                  isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>{opt.label}</span>
                <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                  isSelected
                    ? 'bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold'
                    : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800'
                }`}>
                  {opt.value === 'all' ? formatNumber(allStatusCount) : formatStatusCount(opt.value)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BỘ LỌC ĐÃ LƯU SECTION */}
      <div>
        <div className="flex items-center justify-between px-2 mb-2.5 text-slate-400 dark:text-slate-500 font-bold tracking-wider text-xs uppercase">
          <span>BỘ LỌC ĐÃ LƯU</span>
          <button
            onClick={onSaveCurrentFilter}
            title="Lưu bộ lọc"
            className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5 rounded cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          {savedFilters.map((sf) => {
            const isFilterActive = activeSavedFilter === sf.id;
            return (
              <button
                key={sf.id}
                onClick={() => {
                  onSelectSavedFilter(sf);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
                  isFilterActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="truncate">{sf.name}</span>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500 ml-1">
                  {sf.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onSaveCurrentFilter}
          className="w-full mt-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs py-1.5 text-left px-2 flex items-center space-x-1.5 transition-colors cursor-pointer font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
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
            className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
          />
          <div className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-50 shadow-2xl border-r border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-200 flex flex-col">
            {content}
          </div>
        </>
      )}

      {/* Desktop Fixed Left Pane */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex-col h-full shadow-xs transition-colors">
        {content}
      </aside>
    </>
  );
};
