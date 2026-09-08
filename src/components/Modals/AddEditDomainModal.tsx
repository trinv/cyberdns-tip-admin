import React, { useState, useEffect } from 'react';
import { CategoryInfo, DomainItem } from '../../types';

interface AddEditDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainToEdit?: DomainItem | null;
  categories: CategoryInfo[];
  onSave: (domainData: Partial<DomainItem>, reason: string) => void;
}

export const AddEditDomainModal: React.FC<AddEditDomainModalProps> = ({
  isOpen,
  onClose,
  domainToEdit,
  categories,
  onSave,
}) => {
  const isEditing = !!domainToEdit;
  const [domainName, setDomainName] = useState(domainToEdit ? domainToEdit.domain : '');
  // For a new domain, starts empty rather than a hardcoded guess like
  // 'gambling' — see the same fix in SourcesView.tsx for why: an id that
  // doesn't actually exist in this install's categories table passes
  // client-side validation fine but fails at the DB's foreign key the
  // moment it's actually used. Editing keeps the domain's real category.
  const [selectedCat, setSelectedCat] = useState(domainToEdit ? domainToEdit.primaryCategory : '');
  useEffect(() => {
    if (isEditing || categories.length === 0) return;
    if (!categories.some((c) => c.id === selectedCat)) {
      setSelectedCat(categories[0].id);
    }
  }, [categories, isEditing, selectedCat]);
  const [reason, setReason] = useState(isEditing ? 'Cập nhật phân loại theo bằng chứng mới' : 'Thêm mới domain phát hiện qua query log');
  const [status, setStatus] = useState(domainToEdit ? domainToEdit.status : 'active');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainName.trim() || !reason.trim() || !selectedCat) return;

    onSave(
      {
        domain: domainName.trim().toLowerCase(),
        primaryCategory: selectedCat,
        categories: [selectedCat],
        status,
        source: domainToEdit ? domainToEdit.source : 'Thủ công',
        sourceDetail: 'Admin / Manual entry',
      },
      reason
    );

    onClose();
  };

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-6 fw-bold">
                {isEditing ? `Sửa tên miền: ${domainToEdit.domain}` : 'Đề xuất tên miền chặn mới'}
              </h2>
              <button onClick={onClose} className="btn-close" />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body d-flex flex-column gap-3">
                <div>
                  <label className="form-label small fw-bold">
                    Tên miền (Domain) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={domainName}
                    onChange={(e) => setDomainName(e.target.value)}
                    placeholder="ví dụ: nohu-casino88.top"
                    className="form-control font-monospace"
                  />
                </div>

                <div className="row g-3">
                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-bold">
                      Nhóm (Category) <span className="text-primary">*</span>
                    </label>
                    <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)} className="form-select">
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-sm-6">
                    <label className="form-label small fw-bold">Trạng thái</label>
                    <select value={status} onChange={(e: any) => setStatus(e.target.value)} className="form-select">
                      <option value="active">Đang chặn (Active block)</option>
                      <option value="allowlist">Trong allowlist (Miễn trừ)</option>
                      <option value="unblocked">Đã thôi chặn (Unblock)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label small fw-bold">
                    Lý do <span className="text-danger">*</span> (bắt buộc ghi nhận kiểm toán)
                  </label>
                  <input
                    type="text"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Nhập lý do thực hiện..."
                    className="form-control"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="btn btn-light border">Hủy</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Lưu thay đổi' : 'Gửi để duyệt'}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
