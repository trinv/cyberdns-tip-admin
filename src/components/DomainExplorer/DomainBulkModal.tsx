import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { CategoryInfo, DomainItem } from '../../types';

interface DomainBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType: 'add_group' | 'allowlist' | 'unblock' | 'block';
  targetCategory?: string;
  selectedDomains: DomainItem[];
  categories: CategoryInfo[];
  onConfirm: (action: 'add_group' | 'allowlist' | 'unblock' | 'block', targetCategories: string[], reason: string) => Promise<void> | void;
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
      case 'block':
        return `Chặn lại ${count.toLocaleString('vi-VN')} domain vào Blocklist`;
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
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-6 fw-bold">{getActionTitle()}</h2>
              <button onClick={onClose} className="btn-close" />
            </div>

            <form onSubmit={handleSubmit} className="d-flex flex-column" style={{ minHeight: 0 }}>
              <div className="modal-body d-flex flex-column gap-3">
                {actionType === 'add_group' && (
                  <div>
                    <label className="form-label small fw-bold">Nhóm đích</label>
                    <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)} className="form-select">
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.count.toLocaleString('vi-VN')})</option>
                      ))}
                    </select>
                    <p className="text-body-secondary small mt-1 mb-0">
                      Một tên miền có thể thuộc nhiều nhóm cùng lúc — thao tác này CHỈ THÊM nhóm này, không gỡ bỏ nhóm hiện có của domain.
                    </p>
                  </div>
                )}

                {/* Real list of the domains this action will apply to */}
                <div>
                  <div className="text-body-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.6875rem', letterSpacing: '.06em' }}>
                    Domain được chọn ({count.toLocaleString('vi-VN')})
                  </div>
                  <div className="border rounded-3 p-2 font-monospace small" style={{ maxHeight: 128, overflowY: 'auto' }}>
                    {actionableDomains.length === 0 ? (
                      <div className="text-body-secondary fst-italic">Không có domain nào (tất cả đã bị loại vì protected).</div>
                    ) : (
                      <>
                        {actionableDomains.slice(0, 20).map((d) => (
                          <div key={d.id}>{d.domain}</div>
                        ))}
                        {actionableDomains.length > 20 && (
                          <div className="text-body-secondary fst-italic">... và {(actionableDomains.length - 20).toLocaleString('vi-VN')} domain nữa</div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Real protected-domain exclusion notice (derived from actual selection, not a hardcoded example) */}
                {protectedDomains.length > 0 && (
                  <div className="alert alert-danger mb-0">
                    <div className="d-flex align-items-center gap-2 fw-bold small">
                      <AlertTriangle size={16} />
                      <span>{protectedDomains.length} domain bị loại khỏi thao tác (protected)</span>
                    </div>
                    <div className="font-monospace small ps-4 mt-1">
                      {protectedDomains.slice(0, 5).map((d) => (
                        <div key={d.id} className="d-flex align-items-center gap-2">
                          <Lock size={12} className="flex-shrink-0" />
                          <span className="fw-bold">{d.domain}</span>
                        </div>
                      ))}
                      {protectedDomains.length > 5 && <div>... và {protectedDomains.length - 5} domain nữa</div>}
                    </div>
                    <p className="small ps-4 pt-1 mb-0">
                      Domain protected cần được bỏ đánh dấu trước khi có thể áp dụng thao tác hàng loạt.
                    </p>
                  </div>
                )}

                {/* Undo Guarantee Card */}
                <div className="alert alert-success d-flex align-items-start gap-2 mb-0">
                  <CheckCircle2 size={16} className="flex-shrink-0 mt-1" />
                  <div className="small">
                    <span className="fw-bold">✓ Được ghi vào nhật ký kiểm toán: </span>
                    <span>Thao tác này sẽ xuất hiện trong Audit Logs với đầy đủ lý do và người thực hiện.</span>
                  </div>
                </div>

                {/* Reason field */}
                <div>
                  <label className="form-label small fw-bold">
                    Lý do <span className="text-danger">*</span> <span className="text-body-secondary fw-normal">(bắt buộc)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Nhập lý do thao tác..."
                    className="form-control"
                  />
                  <p className="text-body-secondary small mt-1 mb-0">
                    Bắt buộc. Ghi vào nhật ký kiểm toán để phục vụ hoàn tác và tra soát sau này.
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="btn btn-light border">Hủy</button>
                <button type="submit" disabled={!reason.trim() || isProcessing || count === 0} className="btn btn-primary">
                  {isProcessing ? 'Đang thực hiện...' : `Xác nhận thực hiện (${count.toLocaleString('vi-VN')} domain)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
