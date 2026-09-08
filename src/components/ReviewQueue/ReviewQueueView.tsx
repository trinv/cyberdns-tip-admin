import React, { useState } from 'react';
import { ReviewDomainItem, CategoryInfo } from '../../types';
import { CheckCircle2, Check, CheckCheck } from 'lucide-react';

interface ReviewQueueViewProps {
  items: ReviewDomainItem[];
  categories: CategoryInfo[];
  onApprove: (id: string, category: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({
  items,
  categories,
  onApprove,
  onReject,
  onApproveAll,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filteredItems = items.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.proposedCategory === selectedFilter;
  });

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Hàng đợi kiểm duyệt (Review Queue)</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800">
              {items.length} domain cần xử lý
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Các tên miền có dấu hiệu độc hại / cờ bạc do AI Crawler và hệ thống giám sát bất thường DNS phát hiện tự động.
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={onApproveAll}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center space-x-2 cursor-pointer shadow-sm active-press"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Duyệt chặn toàn bộ ({items.length})</span>
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider">Lọc theo:</span>
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            selectedFilter === 'all'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}
        >
          Tất cả ({items.length})
        </button>
        {categories.map((c) => {
          const count = items.filter((i) => i.proposedCategory === c.id).length;
          if (count === 0) return null;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedFilter(c.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                selectedFilter === c.id
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Review Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2 shadow-xs transition-colors">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <p className="font-bold text-slate-800 dark:text-slate-200 text-base">Hàng đợi trống</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs">Tất cả tên miền nghi vấn đã được duyệt hoặc xử lý an toàn!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-2xl p-5 space-y-4 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>{item.domain}</span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      {item.proposedCategory}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                    Phát hiện: {item.createdAt} · {item.reportedBy}
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                    Threat: {(item.threatScore * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                    {item.queryCount24h.toLocaleString('vi-VN')} req/24h
                  </div>
                </div>
              </div>

              {/* Reason box */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  <span className="text-slate-400 dark:text-slate-500 font-bold">Lý do: </span>
                  {item.reason}
                </div>
                <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {item.evidenceNotes}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onReject(item.id)}
                    className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer active-press"
                  >
                    Từ chối (R)
                  </button>

                  <button
                    onClick={() => onApprove(item.id, item.proposedCategory)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center space-x-1 cursor-pointer shadow-xs active-press"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Duyệt chặn (A)</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
