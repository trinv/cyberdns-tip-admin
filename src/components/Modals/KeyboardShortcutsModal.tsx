import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'j / k', desc: 'Di chuyển lên / xuống giữa các dòng tên miền' },
    { key: 'x', desc: 'Chọn hoặc bỏ chọn dòng hiện tại' },
    { key: 'e', desc: 'Mở cửa sổ sửa nhóm phân loại nhanh' },
    { key: '⌘K / Ctrl+K', desc: 'Kích hoạt thanh tìm kiếm tên miền' },
    { key: '⌘Z / Ctrl+Z', desc: 'Hoàn tác giao dịch gần nhất (trong 10 phút)' },
    { key: 'A', desc: 'Duyệt chặn tên miền trong hàng đợi (Review queue)' },
    { key: 'R', desc: 'Từ chối tên miền trong hàng đợi' },
    { key: 'Esc', desc: 'Đóng modal hoặc drawer chi tiết' },
    { key: '?', desc: 'Mở bảng phím tắt này' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">Phím tắt thao tác nhanh</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {shortcuts.map((sc, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300 font-medium">{sc.desc}</span>
                <kbd className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold shadow-xs">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active-press"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
