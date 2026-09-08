import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Loader2 } from 'lucide-react';
import { DnsNode, GeoCountry, GeoProvince } from '../../types';
import { fetchGeoCountries, fetchGeoProvinces } from '../../lib/api';

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
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [hostname, setHostname] = useState('');
  const [tier, setTier] = useState<(typeof TIERS)[number]>('LITE');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [location, setLocation] = useState('');
  const [provider, setProvider] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ---- Country/Province location picker ----
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [countryIso, setCountryIso] = useState('');
  const [provinces, setProvinces] = useState<GeoProvince[]>([]);
  const [selectedProvinceName, setSelectedProvinceName] = useState('');
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);

  // This component is never unmounted between uses (DnsNodesView keeps one
  // long-lived instance and just toggles `isOpen` — same pattern as
  // AddEditDomainModal.tsx), so every field is synced from props HERE
  // (rather than only via useState's one-time initializer) every time the
  // modal actually opens, or `nodeToEdit` changes while it's open — without
  // this, reopening for a different node (or "Thêm mới" right after editing
  // one) would keep showing the PREVIOUS node's stale form values, including
  // a Country/Province selection that no longer has anything to do with
  // what's on screen.
  useEffect(() => {
    if (!isOpen) return;
    setName(nodeToEdit?.name || '');
    setIpAddress(nodeToEdit?.ipAddress || '');
    setHostname(nodeToEdit?.hostname || '');
    setTier((nodeToEdit?.tier as (typeof TIERS)[number]) || 'LITE');
    setStatus(nodeToEdit?.status || 'active');
    setLocation(nodeToEdit?.location || '');
    setProvider(nodeToEdit?.provider || '');
    setLatitude(nodeToEdit?.latitude != null ? String(nodeToEdit.latitude) : '');
    setLongitude(nodeToEdit?.longitude != null ? String(nodeToEdit.longitude) : '');
    setNotes(nodeToEdit?.notes || '');
    // Country/Province always start unselected on open — an existing node's
    // free-text `location` (e.g. "Hà Nội - VNPT IDC", entered before this
    // picker existed) can't be reliably reverse-matched to one exact dataset
    // entry, so this only ever OVERWRITES location/lat/lng once the admin
    // explicitly picks one.
    setCountryIso('');
    setProvinces([]);
    setSelectedProvinceName('');
  }, [isOpen, nodeToEdit]);

  useEffect(() => {
    if (!isOpen) return;
    fetchGeoCountries()
      .then(setCountries)
      .catch((err) => console.warn('fetchGeoCountries failed:', err));
  }, [isOpen]);

  useEffect(() => {
    setSelectedProvinceName('');
    if (!isOpen || !countryIso) {
      setProvinces([]);
      return;
    }
    setIsLoadingProvinces(true);
    fetchGeoProvinces(countryIso)
      .then(setProvinces)
      .catch((err) => {
        console.warn('fetchGeoProvinces failed:', err);
        setProvinces([]);
      })
      .finally(() => setIsLoadingProvinces(false));
  }, [isOpen, countryIso]);

  const handleSelectProvince = (provinceName: string) => {
    setSelectedProvinceName(provinceName);
    const province = provinces.find((p) => p.name === provinceName);
    if (!province) return;
    const countryName = countries.find((c) => c.isoCode === countryIso)?.name || '';
    setLocation(countryName ? `${province.name}, ${countryName}` : province.name);
    setLatitude(String(province.latitude));
    setLongitude(String(province.longitude));
  };

  // ---- Preview map (Leaflet + OpenStreetMap, free, no API key) — shows
  // exactly where the currently entered lat/lng points to, live. ----
  const previewMapContainerRef = useRef<HTMLDivElement>(null);
  const previewMapRef = useRef<L.Map | null>(null);
  const previewMarkerRef = useRef<L.Marker | null>(null);

  const previewLat = latitude.trim() ? Number(latitude) : null;
  const previewLng = longitude.trim() ? Number(longitude) : null;
  const hasValidPreview =
    previewLat != null && previewLng != null && Number.isFinite(previewLat) && Number.isFinite(previewLng);

  // Tied to `isOpen` (not `[]`) and always returns its own cleanup — since
  // this component never truly unmounts between opens (see the sync effect
  // above), a mount-once effect would create the map on the FIRST open, but
  // `map.remove()` would never run on close (the container div itself gets
  // removed from the DOM when this returns null below, without React ever
  // unmounting the component to trigger effect cleanup) — leaving `mapRef`
  // pointing at a dead map and the container empty on every reopen after
  // the first. Re-running per `isOpen` toggle creates a fresh map bound to
  // the freshly-mounted container on every open, and cleanly tears it down
  // on every close.
  useEffect(() => {
    if (!isOpen || !previewMapContainerRef.current) return;
    const map = L.map(previewMapContainerRef.current, {
      center: [16.0, 106.0],
      zoom: 3,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    previewMapRef.current = map;
    return () => {
      map.remove();
      previewMapRef.current = null;
      previewMarkerRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    const map = previewMapRef.current;
    if (!map) return;
    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }
    if (hasValidPreview) {
      previewMarkerRef.current = L.marker([previewLat!, previewLng!]).addTo(map);
      map.setView([previewLat!, previewLng!], 9);
    } else {
      map.setView([16.0, 106.0], 3);
    }
  }, [hasValidPreview, previewLat, previewLng]);

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

          {/* ---- Location picker: Country -> Province/City (dropdown),
              coordinates auto-filled from the selection and shown live on
              the map below. Province-level (Tỉnh/Thành phố), not city-level
              — see src/lib/geo.ts's own note on why. ---- */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              VỊ TRÍ (chọn Quốc gia rồi Tỉnh/Thành phố)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <select
                value={countryIso}
                onChange={(e) => setCountryIso(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                <option value="">— Quốc gia —</option>
                {countries.map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <select
                  value={selectedProvinceName}
                  disabled={!countryIso || isLoadingProvinces}
                  onChange={(e) => handleSelectProvince(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!countryIso
                      ? 'Chọn quốc gia trước'
                      : isLoadingProvinces
                      ? 'Đang tải...'
                      : provinces.length === 0
                      ? 'Không có dữ liệu tỉnh/thành'
                      : '— Tỉnh/Thành phố —'}
                  </option>
                  {provinces.map((p) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
                {isLoadingProvinces && (
                  <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {countryIso && !isLoadingProvinces && provinces.length === 0 && (
              <p className="text-amber-600 dark:text-amber-400">
                Quốc gia này không có danh sách tỉnh/thành trong dữ liệu — vui lòng nhập toạ độ thủ công bên dưới.
              </p>
            )}

            {location && (
              <p className="text-slate-500 dark:text-slate-400">
                Vị trí đã chọn: <span className="font-semibold text-slate-700 dark:text-slate-300">{location}</span>
              </p>
            )}

            <div ref={previewMapContainerRef} className="w-full h-36 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 isolate mt-2" />
            {!hasValidPreview && (
              <p className="text-slate-400 dark:text-slate-500">Chọn Quốc gia và Tỉnh/Thành phố để hiển thị chính xác vị trí trên bản đồ.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                TOẠ ĐỘ (tự động điền, có thể chỉnh tay)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="Vĩ độ"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                />
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="Kinh độ"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                />
              </div>
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
