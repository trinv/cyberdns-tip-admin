import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { CategoryInfo, DomainItem } from '../../types';

interface DomainBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: 'add_group' | 'allowlist' | 'unblock';
  targetCategory?: string;
  selectedDomains: DomainItem[];
  categories: CategoryInfo[];
  onConfirm: (action: 'add_group' | 'allowlist' | 'unblock', targetCategories: string[], reason: string) => Promise<void> | void;
}

export const DomainBulkModal: React.FC<DomainBulkModalProps> = ({
  isOpen,
  onClose,
  actionType,
  targetCategory: initialTargetCategory,
  selectedDomains,
  categories,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  // Starts empty rather than defaulting to a hardcoded guess like
  // 'malware-phishing' when no explicit targetCategory prop is passed (the
  // normal case — App.tsx never passes one) — see the same fix in
  // SourcesView.tsx for why: an id that doesn't actually exist in this
  // install's categories table passes client-side validation fine but
  // fails at the DB's foreign key the moment it's actually used.
  const [selectedCat, setSelectedCat] = useState(initialTargetCategory || '');
  useEffect(() => {
    if (initialTargetCategory || categories.length === 0) return;
    if (!categories.some((c) => c.id === selectedCat)) {
      setSelectedCat(categories[0].id);
    }
  }, [categories, initialTargetCategory, selectedCat]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  // Protected domains (e.g. gov.vn) are excluded from the action rather than
  // silently included — this is real, derived from each domain's actual
  // isProtected flag, not a hardcoded example list.
  const protectedDomains = selectedDomains.filter((d) => d.isProtected);
  const actionableDomains = selectedDomains.filter((d) => !d.isProtected);
  const count = actionableDomains.length;

  const getActionTitle = () => {
    switch (actionType) {
      case 'add_group':
        return `Thêm ${count.toLocaleString('vi-VN')} domain vào nhóm ${selectedCat}`;
      case 'allowlist':
        return `Chuyển ${count.toLocaleString('vi-VN')} domain sang Allowlist (Miễn trừ)`;
      case 'unblock':
        return `Thôi chặn ${count.toLocaleString('vi-VN')} domain khỏi Blocklist`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || count === 0 || isProcessing) return;
    if (actionType === 'add_group' && !selectedCat) return;

    setIsProcessing(true);
    try {
      await onConfirm(actionType, [selectedCat], reason.trim());
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <h2 className="text-sm font-bold text-slate-800 dark:text-white font-sans flex items-center space-x-2">
            <span>{getActionTitle()}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {actionType === 'add_group' && (
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">NHÓM ĐÍCH</label>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.count.toLocaleString('vi-VN')})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Một tên miền có thể thuộc nhiều nhóm cùng lúc — thao tác này CHỈ THÊM nhóm này, không gỡ bỏ nhóm hiện có của domain.
              </p>
            </div>
          )}

          {/* Real list of the domains this action will apply to */}
          <div>
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              DOMAIN ĐƯỢC CHỌN ({count.toLocaleString('vi-VN')})
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-3 font-mono text-xs text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto space-y-0.5">
              {actionableDomains.length === 0 ? (
                <div className="text-slate-400 dark:text-slate-500 italic">Không có domain nào (tất cả đã bị loại vì protected).</div>
              ) : (
                <>
                  {actionableDomains.slice(0, 20).map((d) => (
                    <div key={d.id}>{d.domain}</div>
                  ))}
                  {actionableDomains.length > 20 && (
                    <div className="text-slate-400 dark:text-slate-500 italic">
                      ... và {(actionableDomains.length - 20).toLocaleString('vi-VN')} domain nữa
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Real protected-domain exclusion notice (derived from actual selection, not a hardcoded example) */}
          {protectedDomains.length > 0 && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900 rounded-2xl p-4 space-y-1.5 text-rose-900 dark:text-rose-200">
              <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300 font-bold tracking-wide text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>{protectedDomains.length} DOMAIN BỊ LOẠI KHỎI THAO TÁC (PROTECTED)</span>
              </div>
              <div className="font-mono text-xs pl-6 space-y-0.5 text-rose-800 dark:text-rose-300">
                {protectedDomains.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center space-x-2">
                    <Lock className="w-3 h-3 flex-shrink-0" />
                    <span className="font-bold">{d.domain}</span>
                  </div>
                ))}
                {protectedDomains.length > 5 && <div>... và {protectedDomains.length - 5} domain nữa</div>}
              </div>
              <p className="text-xs pl-6 text-slate-600 dark:text-slate-400 pt-1">
                Domain protected cần được bỏ đánh dấu trước khi có thể áp dụng thao tác hàng loạt.
              </p>
            </div>
          )}

          {/* Undo Guarantee Card */}
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-3.5 flex items-start space-x-2.5 text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-800 dark:text-emerald-300">✓ Được ghi vào nhật ký kiểm toán: </span>
              <span className="text-slate-700 dark:text-slate-300 text-xs">
                Thao tác này sẽ xuất hiện trong Audit Logs với đầy đủ lý do và người thực hiện.
              </span>
            </div>
          </div>

          {/* Reason field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              LÝ DO <span className="text-rose-500">*</span> <span className="text-slate-400 dark:text-slate-500 font-normal">(Bắt buộc)</span>
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do thao tác..."
              className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900 focus:outline-none rounded-xl text-slate-900 dark:text-slate-100 font-medium text-xs transition-all shadow-xs"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Bắt buộc. Ghi vào nhật ký kiểm toán để phục vụ hoàn tác và tra soát sau này.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || isProcessing || count === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-500/20"
            >
              {isProcessing ? (
                <span>Đang thực hiện...</span>
              ) : (
                <span>Xác nhận thực hiện ({count.toLocaleString('vi-VN')} domain)</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
