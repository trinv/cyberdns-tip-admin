import React from 'react';
import { Keyboard } from 'lucide-react';

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
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
                <Keyboard size={16} className="text-primary" />
                <span>Phím tắt thao tác nhanh</span>
              </h2>
              <button onClick={onClose} className="btn-close" />
            </div>

            <div className="modal-body">
              <div className="d-flex flex-column">
                {shortcuts.map((sc, idx) => (
                  <div key={idx} className={`py-2 d-flex align-items-center justify-content-between small ${idx > 0 ? 'border-top' : ''}`}>
                    <span className="fw-medium">{sc.desc}</span>
                    <kbd>{sc.key}</kbd>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={onClose} className="btn btn-primary">Đóng</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
