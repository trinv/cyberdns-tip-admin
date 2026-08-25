import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
  const [selectedCat, setSelectedCat] = useState(domainToEdit ? domainToEdit.primaryCategory : 'gambling');
  const [reason, setReason] = useState(isEditing ? 'Cập nhật phân loại theo bằng chứng mới' : 'Thêm mới domain phát hiện qua query log');
  const [status, setStatus] = useState(domainToEdit ? domainToEdit.status : 'active');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainName.trim() || !reason.trim()) return;

    onSave(
      {
        domain: domainName.trim().toLowerCase(),
        primaryCategory: selectedCat,
        categories: [selectedCat],
        status,
        // For a brand-new domain there is no real WHOIS/ASN lookup here yet
        // — leave asn/domainAge unset so the backend's honest "Unknown"
        // defaults apply, instead of a specific-looking fabricated value.
        // When editing, keep the domain's existing (real) values as-is.
        ...(domainToEdit ? { asn: domainToEdit.asn, domainAge: domainToEdit.domainAge } : {}),
        source: domainToEdit ? domainToEdit.source : 'Thủ công',
        sourceDetail: 'Admin / Manual entry',
      },
      reason
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-sans">
            {isEditing ? `Sửa tên miền: ${domainToEdit.domain}` : 'Đề xuất tên miền chặn mới'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              TÊN MIỀN (DOMAIN) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isEditing}
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              placeholder="ví dụ: nohu-casino88.top"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                NHÓM (CATEGORY) <span className="text-emerald-600 dark:text-emerald-400">*</span>
              </label>
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3 py-2 font-bold text-xs text-emerald-700 dark:text-emerald-300 focus:outline-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                TRẠNG THÁI
              </label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="active">Đang chặn (Active block)</option>
                <option value="grace_period">Trong ân hạn (Grace period)</option>
                <option value="allowlist">Trong allowlist (Miễn trừ)</option>
                <option value="unblocked">Đã thôi chặn (Unblock)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              LÝ DO <span className="text-rose-500">*</span> (Bắt buộc ghi nhận kiểm toán)
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do thực hiện..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none shadow-xs font-medium"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active-press"
            >
              {isEditing ? 'Lưu thay đổi' : 'Gửi để duyệt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
