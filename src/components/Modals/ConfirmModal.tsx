import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

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
    iconWrap: 'bg-danger-subtle text-danger',
    icon: AlertTriangle,
    confirmBtn: 'btn-danger',
  },
  warning: {
    iconWrap: 'bg-warning-subtle text-warning-emphasis',
    icon: AlertTriangle,
    confirmBtn: 'btn-warning',
  },
  default: {
    iconWrap: 'bg-success-subtle text-success',
    icon: Info,
    confirmBtn: 'btn-primary',
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
    // ConfirmModal can appear ON TOP of another already-open modal (e.g.
    // CategoryManagerModal's own delete confirmation) — Bootstrap has no
    // built-in nested-modal stacking, so this one's own backdrop/dialog get
    // explicit z-index values above Bootstrap's defaults
    // (--bs-backdrop-zindex: 1050, --bs-modal-zindex: 1055) to guarantee it
    // renders above a default-stacked parent modal.
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1065 }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body d-flex flex-column gap-3">
              <div className="d-flex align-items-start justify-content-between">
                <div className={`kpi-icon ${iconWrap}`}>
                  <ToneIcon size={18} />
                </div>
                <button onClick={onCancel} className="btn-close" />
              </div>

              <div>
                <h2 className="fs-6 fw-bold mb-1">{title}</h2>
                <p className="text-body-secondary mb-0" style={{ lineHeight: 1.6 }}>{message}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={onCancel} disabled={isProcessing} className="btn btn-light border">
                {cancelLabel}
              </button>
              <button type="button" onClick={onConfirm} disabled={isProcessing} className={`btn ${confirmBtn}`}>
                {isProcessing ? 'Đang xử lý...' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
