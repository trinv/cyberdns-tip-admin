import React from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';

export type ConfirmTone = 'danger' | 'warning' | 'default';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_STYLES: Record<ConfirmTone, {
  iconWrap: string;
  icon: React.ElementType;
  confirmBtn: string;
}> = {
  danger: {
    iconWrap: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
    icon: AlertTriangle,
    confirmBtn: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20',
  },
  warning: {
    iconWrap: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
  },
  default: {
    iconWrap: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
    icon: Info,
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
  },
};

// Shared confirm dialog, styled to match the rest of the app — replaces raw
// window.confirm() calls, which render as an unstyled browser-native prompt
// (can't be themed, doesn't match dark mode, breaks the visual consistency
// of the rest of the admin portal).
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'default',
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const { iconWrap, icon: ToneIcon, confirmBtn } = TONE_STYLES[tone];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconWrap}`}>
              <ToneIcon className="w-5 h-5" />
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer -mt-1 -mr-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">{title}</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{message}</p>
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className={`px-5 py-2 text-white font-bold rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 ${confirmBtn}`}
            >
              {isProcessing ? 'Đang xử lý...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
