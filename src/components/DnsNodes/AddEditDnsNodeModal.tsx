import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DnsNode } from '../../types';

interface AddEditDnsNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeToEdit?: DnsNode | null;
  onSave: (data: Partial<DnsNode>) => Promise<void> | void;
}

const TIERS = ['LITE', 'PRO', 'FAMILY'] as const;

// Add/Edit form for a single CyberDNS DNS node — styled to match
// AddEditDomainModal.tsx's chrome exactly (same header/footer/input
// classes) so this doesn't look like a bolted-on, differently-styled screen.
export const AddEditDnsNodeModal: React.FC<AddEditDnsNodeModalProps> = ({
  isOpen,
  onClose,
  nodeToEdit,
  onSave,
}) => {
  const isEditing = !!nodeToEdit;
  const [name, setName] = useState(nodeToEdit?.name || '');
  const [ipAddress, setIpAddress] = useState(nodeToEdit?.ipAddress || '');
  const [hostname, setHostname] = useState(nodeToEdit?.hostname || '');
  const [tier, setTier] = useState<(typeof TIERS)[number]>((nodeToEdit?.tier as any) || 'LITE');
  const [status, setStatus] = useState<'active' | 'inactive'>(nodeToEdit?.status || 'active');
  const [location, setLocation] = useState(nodeToEdit?.location || '');
  const [provider, setProvider] = useState(nodeToEdit?.provider || '');
  const [latitude, setLatitude] = useState(nodeToEdit?.latitude != null ? String(nodeToEdit.latitude) : '');
  const [longitude, setLongitude] = useState(nodeToEdit?.longitude != null ? String(nodeToEdit.longitude) : '');
  const [notes, setNotes] = useState(nodeToEdit?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  // Basic IPv4/IPv6 sanity check — not exhaustive RFC validation, just
  // enough to catch an obvious typo (e.g. a hostname pasted into the IP
  // field) before it hits the ACL's exact-match check server-side.
  const isValidIp = (v: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v.trim()) || /^[0-9a-fA-F:]+$/.test(v.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ipAddress.trim() || !isValidIp(ipAddress)) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        ipAddress: ipAddress.trim(),
        hostname: hostname.trim() || null,
        tier,
        status,
        location: location.trim() || null,
        provider: provider.trim() || null,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
        notes: notes.trim() || null,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-xs text-slate-700 dark:text-slate-300 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 flex-shrink-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white font-sans">
            {isEditing ? `Sửa DNS node: ${nodeToEdit.name}` : 'Thêm DNS node mới'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                TÊN NODE <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ví dụ: HN-EDGE-01"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                ĐỊA CHỈ IP <span className="text-rose-500">*</span> (khoá ACL)
              </label>
              <input
                type="text"
                required
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="ví dụ: 103.21.244.10"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              HOSTNAME (chỉ hiển thị, không dùng để so khớp ACL)
            </label>
            <input
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="ví dụ: hn-edge-01.cyberdns.vn"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">TIER</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as (typeof TIERS)[number])}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 font-bold text-xs text-emerald-700 dark:text-emerald-300 focus:outline-none cursor-pointer"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">TRẠNG THÁI</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">VỊ TRÍ</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ví dụ: Hà Nội - VNPT IDC"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">NHÀ CUNG CẤP</label>
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="ví dụ: Viettel IDC"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                VĨ ĐỘ (LATITUDE) — tuỳ chọn, để ghim lên bản đồ
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="ví dụ: 21.0278"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">KINH ĐỘ (LONGITUDE)</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="ví dụ: 105.8342"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">GHI CHÚ KHÁC</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Thông tin khác (tuỳ chọn)..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none"
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
              disabled={isSaving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active-press disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Thêm node'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
