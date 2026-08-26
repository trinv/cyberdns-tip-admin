import React, { useState } from 'react';
import { DomainItem, CategoryInfo } from '../../types';
import { X, Clock, Globe, Copy, Check } from 'lucide-react';

// No per-domain quick actions here anymore (Sửa nhóm / Thay đổi trạng
// thái were removed per explicit request) — every domain action, single
// or multiple, now goes through checkbox-select + the bulk action toolbar
// (DomainTable.tsx) instead of maintaining 3 separate action surfaces
// (this panel, a per-row "..." menu, and the bulk bar) offering the same
// things. This panel is now purely informational.
interface DomainInspectorProps {
  domain: DomainItem | null;
  categories: CategoryInfo[];
  onClose: () => void;
}

export const DomainInspector: React.FC<DomainInspectorProps> = ({
  domain,
  categories,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!domain) return;
    navigator.clipboard.writeText(domain.domain);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!domain) {
    return (
      <aside className="hidden xl:flex w-84 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 p-6 flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 text-xs select-none shadow-xs transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
          <Globe className="w-6 h-6" />
        </div>
        <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">Chọn một tên miền</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
          Nhấn vào bất kỳ dòng nào trong bảng để xem chi tiết lý lịch threat intel, timeline và các hành động.
        </p>
      </aside>
    );
  }

  const inspectorContent = (
    <div className="flex flex-col h-full overflow-y-auto select-none p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300 shadow-xs font-sans transition-colors scrollbar-thin">
      {/* Header with Close */}
      <div>
        <div className="flex items-start justify-between">
          <div className="space-y-1 max-w-[240px]">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white break-all leading-tight">
                {domain.domain}
              </h3>
              <button
                onClick={handleCopy}
                title="Sao chép tên miền"
                className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-0.5 rounded cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
              eTLD+1: <span className="text-slate-700 dark:text-slate-300 font-semibold">{domain.etld1}</span> · TLD: <span className="text-slate-700 dark:text-slate-300 font-semibold">.{domain.tld}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Key-Value Properties Grid */}
      <div className="space-y-2.5 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
            NHÓM
          </span>
          <div className="flex flex-wrap gap-1">
            {domain.categories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Stacked (label above value), not the side-by-side layout the
            other rows use — sourceDetail can be a long sentence (e.g. a
            feed-synced domain's "Đồng bộ tự động từ nguồn feed ..."
            reason), and forcing a long value into a narrow
            `justify-between` column made it wrap unevenly, reading as if
            it were centered rather than simply wrapped. */}
        <div className="space-y-1">
          <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider block">
            NGUỒN
          </span>
          <span className="font-mono text-slate-800 dark:text-slate-200 font-medium text-xs leading-relaxed block">
            {domain.sourceDetail || domain.source}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold tracking-wider">
            TRẠNG THÁI
          </span>
          <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
            domain.status === 'active' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800' :
            domain.status === 'allowlist' ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800' :
            'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
          }`}>
            {domain.status === 'active' ? 'Đang chặn (Active)' : domain.status}
          </span>
        </div>

      </div>

      {/* DÒNG THỜI GIAN (Timeline) */}
      <div>
        <div className="flex items-center space-x-1.5 mb-2.5 text-slate-400 dark:text-slate-500 font-bold tracking-wider text-xs uppercase">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>LỊCH SỬ THAO TÁC</span>
        </div>

        <div className="space-y-3 relative before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800 pl-4">
          {domain.timeline && domain.timeline.map((event, idx) => (
            <div key={idx} className="relative group">
              <span className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-emerald-600 ring-4 ring-white dark:ring-slate-900 shadow-xs"></span>
              <div className="space-y-0.5">
                <div className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  <span>{event.time}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-snug font-medium">
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* Mobile/Tablet Slide-over Drawer (< xl) */}
      <div className="xl:hidden">
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 animate-in fade-in duration-200"
        />
        <div className="fixed inset-y-0 right-0 w-84 sm:w-96 bg-white dark:bg-slate-900 z-50 shadow-2xl border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 flex flex-col">
          {inspectorContent}
        </div>
      </div>

      {/* Desktop Persistent Pane (>= xl) */}
      <aside className="hidden xl:flex w-84 2xl:w-92 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 flex-col h-full shadow-xs transition-colors">
        {inspectorContent}
      </aside>
    </>
  );
};
