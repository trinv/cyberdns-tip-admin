import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DottedMap from 'dotted-map/without-countries';
import worldDotMap from './worldDotMap';
import { DnsNode, BlocklistAclSettings, BlocklistUnknownRequester } from '../../types';
import {
  fetchDnsNodes,
  createDnsNodeApi,
  updateDnsNodeApi,
  deleteDnsNodeApi,
  fetchBlocklistAclSettings,
  setBlocklistAclEnforceApi,
  fetchUnknownRequesters,
} from '../../lib/api';
import { AddEditDnsNodeModal } from './AddEditDnsNodeModal';
import { ConfirmModal } from '../Modals/ConfirmModal';
import {
  Server,
  Plus,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Trash2,
  ExternalLink,
  Radio,
  CheckCircle2,
} from 'lucide-react';

const TIER_BADGE: Record<string, string> = {
  LITE: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  PRO: 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  FAMILY: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

// Build-time only (see .env.example) — Uptime Kuma isn't run by this app,
// this just links out to wherever the operator has deployed it.
const UPTIME_KUMA_URL: string = (import.meta as any).env?.VITE_UPTIME_KUMA_URL || '';

// Admin-only screen (see the 'dns-nodes' Sidebar item's Admin gate) for
// CyberDNS's own real DNS resolver fleet — an operational inventory PLUS
// the source of truth for the Blocklist-URL ACL (see evaluateBlocklistAccess
// in src/db/queries.ts). Self-contained: fetches its own data, matching
// LoginHistoryView.tsx's pattern, since nothing else in the app needs this
// list.
export const DnsNodesView: React.FC = () => {
  const [nodes, setNodes] = useState<DnsNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aclSettings, setAclSettings] = useState<BlocklistAclSettings | null>(null);
  const [unknownRequesters, setUnknownRequesters] = useState<BlocklistUnknownRequester[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState<DnsNode | null>(null);
  const [nodeToDelete, setNodeToDelete] = useState<DnsNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aclConfirmMode, setAclConfirmMode] = useState<'enable' | 'disable' | null>(null);
  const [isTogglingAcl, setIsTogglingAcl] = useState(false);

  // Lightweight local success/warning banner — this view is self-contained
  // (doesn't thread through App.tsx's global toast plumbing), same reasoning
  // as its self-fetching data above.
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(null);
  const showMessage = (text: string, tone: 'success' | 'warning' = 'success') => {
    setMessage({ text, tone });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    Promise.all([fetchDnsNodes(), fetchBlocklistAclSettings(), fetchUnknownRequesters()])
      .then(([nodeList, settings, unknown]) => {
        setNodes(nodeList);
        setAclSettings(settings);
        setUnknownRequesters(unknown);
      })
      .catch((err) => setError(err?.message || 'Không thể tải dữ liệu DNS Node.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Dotted world map (https://github.com/NTag/dotted-map) ----
  // Built from a precomputed grid (see scripts/generate-dotted-map.mjs —
  // computing this grid live in the browser can take up to ~30s per the
  // library's own docs, so it's generated once offline instead) — only the
  // cheap per-pin lookups below run at runtime. Replaces the earlier
  // Leaflet+OpenStreetMap map: besides matching this app's flatter,
  // dot-grid admin aesthetic better than literal map tiles, it also sidesteps
  // a real bug Leaflet had here — its internal control/tile panes set their
  // own z-index up to 1000, which isn't contained in a local stacking
  // context, so they rendered on TOP of the Add/Edit modal (z-50) despite
  // being earlier in the DOM. A plain inline SVG has no such competing
  // z-index of its own, so that class of bug can't recur.
  const dottedMap = useMemo(() => new DottedMap({ map: worldDotMap }), []);

  // Static (doesn't depend on `nodes`) — dots use `fill="currentColor"`
  // (universally well-supported in inline SVG, unlike a raw CSS var()
  // reference inside a presentation attribute) so their actual color comes
  // from the wrapping element's `text-*` Tailwind class below and adapts to
  // light/dark automatically, with no need to regenerate this on theme
  // toggle.
  const baseMapSvg = useMemo(
    () =>
      dottedMap
        .getSVG({ shape: 'circle', color: 'currentColor', backgroundColor: 'transparent', radius: 0.32 })
        .replace('<svg viewBox', '<svg width="100%" height="100%" viewBox'),
    [dottedMap]
  );

  const mapWidth = dottedMap.image.width;
  const mapHeight = dottedMap.image.height;

  const pinnedNodes = useMemo(
    () =>
      nodes
        .filter((n): n is DnsNode & { latitude: number; longitude: number } => n.latitude != null && n.longitude != null)
        .map((n) => ({ node: n, point: dottedMap.getPin({ lat: n.latitude, lng: n.longitude }) }))
        .filter((p): p is { node: typeof p.node; point: NonNullable<typeof p.point> } => !!p.point),
    [dottedMap, nodes]
  );

  // ---- Mutations ----
  const handleSaveNode = async (data: Partial<DnsNode>) => {
    try {
      if (nodeToEdit) {
        const updated = await updateDnsNodeApi(nodeToEdit.id, data);
        setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        showMessage(`Đã cập nhật node "${updated.name}".`);
      } else {
        const created = await createDnsNodeApi(data);
        setNodes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        showMessage(`Đã thêm node "${created.name}".`);
      }
    } catch (err: any) {
      showMessage(err?.message || 'Không thể lưu DNS node — vui lòng thử lại.', 'warning');
      throw err; // keep the modal open on failure
    }
  };

  const handleToggleNodeStatus = async (node: DnsNode) => {
    const nextStatus = node.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateDnsNodeApi(node.id, { status: nextStatus });
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      showMessage(
        nextStatus === 'active' ? `Đã kích hoạt lại node "${updated.name}".` : `Đã tạm ngưng node "${updated.name}".`,
        nextStatus === 'active' ? 'success' : 'warning'
      );
    } catch (err: any) {
      showMessage(err?.message || 'Không thể đổi trạng thái node — vui lòng thử lại.', 'warning');
    }
  };

  const handleConfirmDelete = async () => {
    if (!nodeToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDnsNodeApi(nodeToDelete.id);
      setNodes((prev) => prev.filter((n) => n.id !== nodeToDelete.id));
      showMessage(`Đã xoá node "${nodeToDelete.name}".`, 'warning');
      setNodeToDelete(null);
    } catch (err: any) {
      showMessage(err?.message || 'Không thể xoá node — vui lòng thử lại.', 'warning');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmAclToggle = async () => {
    if (!aclConfirmMode) return;
    setIsTogglingAcl(true);
    try {
      const updated = await setBlocklistAclEnforceApi(aclConfirmMode === 'enable');
      setAclSettings(updated);
      showMessage(
        aclConfirmMode === 'enable'
          ? 'Đã BẬT chặn ACL — chỉ DNS node đang Active mới gọi được Blocklist URL từ bây giờ.'
          : 'Đã TẮT chặn ACL — Blocklist URL phục vụ mọi request như trước, chỉ ghi log IP lạ.',
        aclConfirmMode === 'enable' ? 'warning' : 'success'
      );
      setAclConfirmMode(null);
    } catch (err: any) {
      showMessage(err?.message || 'Không thể đổi cấu hình ACL — vui lòng thử lại.', 'warning');
    } finally {
      setIsTogglingAcl(false);
    }
  };

  const activeCount = nodes.filter((n) => n.status === 'active').length;

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white flex items-center space-x-2">
            <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Quản lý DNS Node</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800">
              {activeCount}/{nodes.length} Active
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Danh sách máy chủ DNS thật của CyberDNS — dùng để giám sát hạ tầng và làm ACL cho Blocklist URL.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={UPTIME_KUMA_URL || undefined}
            target="_blank"
            rel="noreferrer"
            title={UPTIME_KUMA_URL ? undefined : 'Chưa cấu hình VITE_UPTIME_KUMA_URL'}
            aria-disabled={!UPTIME_KUMA_URL}
            onClick={(e) => { if (!UPTIME_KUMA_URL) e.preventDefault(); }}
            className={`px-4 py-2 rounded-xl font-bold flex items-center space-x-1.5 shadow-xs transition-all ${
              UPTIME_KUMA_URL
                ? 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white cursor-pointer active-press'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>DNS Map Monitoring</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={load}
            title="Tải lại"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => { setNodeToEdit(null); setIsAddModalOpen(true); }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active-press"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm node mới</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start space-x-2 rounded-2xl px-4 py-3 font-medium border ${
            message.tone === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
          }`}
        >
          {message.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start space-x-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ACL card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-colors space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                aclSettings?.enforceEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              }`}
            >
              {aclSettings?.enforceEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                ACL Blocklist URL: {aclSettings?.enforceEnabled ? 'ĐANG BẬT (đã chặn IP lạ)' : 'ĐANG TẮT (chỉ ghi log)'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                {aclSettings?.enforceEnabled
                  ? 'Chỉ những IP thuộc DNS node đang Active mới được phép tải Blocklist URL.'
                  : 'Blocklist URL vẫn phục vụ mọi request như trước — rà soát danh sách "IP lạ gần đây" bên dưới trước khi bật chặn thật.'}
                {aclSettings?.updatedBy && (
                  <span className="block mt-0.5 text-slate-400 dark:text-slate-500">
                    Cập nhật lần cuối bởi {aclSettings.updatedBy} · {new Date(aclSettings.updatedAt).toLocaleString('vi-VN')}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAclConfirmMode(aclSettings?.enforceEnabled ? 'disable' : 'enable')}
            disabled={!aclSettings}
            className={`px-4 py-2 rounded-xl font-bold cursor-pointer shadow-xs active-press transition-all disabled:opacity-50 ${
              aclSettings?.enforceEnabled
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {aclSettings?.enforceEnabled ? 'Tắt chặn (về log-only)' : 'Bật chặn ACL'}
          </button>
        </div>

        {unknownRequesters.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              IP lạ gần đây gọi Blocklist URL ({unknownRequesters.length})
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="px-4 py-2">ĐỊA CHỈ IP</th>
                    <th className="px-4 py-2">SỐ LẦN GỌI</th>
                    <th className="px-4 py-2">CATEGORY GẦN NHẤT</th>
                    <th className="px-4 py-2">LẦN CUỐI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-600 dark:text-slate-300">
                  {unknownRequesters.slice(0, 20).map((r) => (
                    <tr key={r.ipAddress}>
                      <td className="px-4 py-2">{r.ipAddress}</td>
                      <td className="px-4 py-2">{r.requestCount.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-2">{r.lastCategory || '—'}</td>
                      <td className="px-4 py-2 text-slate-400 dark:text-slate-500">
                        {new Date(r.lastSeenAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white font-sans mb-3">Bản đồ vị trí & trạng thái node</h2>
        <div
          className="relative w-full isolate rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40"
          style={{ aspectRatio: `${mapWidth} / ${mapHeight}` }}
        >
          <div
            className="absolute inset-0 text-slate-300 dark:text-slate-700"
            dangerouslySetInnerHTML={{ __html: baseMapSvg }}
          />
          {pinnedNodes.map(({ node, point }) => (
            <div
              key={node.id}
              tabIndex={0}
              className="group absolute -translate-x-1/2 -translate-y-1/2 outline-none"
              style={{ left: `${(point.x / mapWidth) * 100}%`, top: `${(point.y / mapHeight) * 100}%` }}
            >
              <span
                className={`block w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 shadow-sm cursor-pointer ${
                  node.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              <div className="pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 dark:bg-slate-700 text-white px-2.5 py-1.5 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-10 shadow-lg font-sans">
                <div className="font-bold">{node.name}</div>
                <div className="text-slate-300">
                  {node.tier} · {node.status === 'active' ? 'Active' : 'Inactive'}
                </div>
                <div className="font-mono text-slate-300">{node.ipAddress}</div>
                {node.location && <div className="text-slate-400">{node.location}</div>}
              </div>
            </div>
          ))}
        </div>
        {nodes.every((n) => n.latitude == null || n.longitude == null) && nodes.length > 0 && (
          <p className="text-slate-400 dark:text-slate-500 mt-2">
            Chưa có node nào được nhập toạ độ — thêm vĩ độ/kinh độ khi sửa node để ghim lên bản đồ.
          </p>
        )}
      </div>

      {/* Node table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">TÊN NODE</th>
                <th className="px-5 py-3.5">IP / HOSTNAME</th>
                <th className="px-5 py-3.5">TIER</th>
                <th className="px-5 py-3.5">VỊ TRÍ</th>
                <th className="px-5 py-3.5">NHÀ CUNG CẤP</th>
                <th className="px-5 py-3.5">TRẠNG THÁI</th>
                <th className="px-5 py-3.5 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {nodes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 font-sans">
                    {isLoading ? 'Đang tải...' : 'Chưa có DNS node nào — bấm "Thêm node mới" để bắt đầu.'}
                  </td>
                </tr>
              )}
              {nodes.map((n) => (
                <tr key={n.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-sans font-semibold text-slate-800 dark:text-slate-200">{n.name}</td>
                  <td className="px-5 py-3.5 font-mono">
                    <div className="text-slate-800 dark:text-slate-200">{n.ipAddress}</div>
                    {n.hostname && <div className="text-slate-400 dark:text-slate-500">{n.hostname}</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full font-bold border font-sans ${TIER_BADGE[n.tier] || TIER_BADGE.LITE}`}>
                      {n.tier}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-sans text-slate-600 dark:text-slate-400">{n.location || '—'}</td>
                  <td className="px-5 py-3.5 font-sans text-slate-600 dark:text-slate-400">{n.provider || '—'}</td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleToggleNodeStatus(n)}
                      title="Bấm để đổi trạng thái"
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full font-bold font-sans border cursor-pointer transition-colors ${
                        n.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${n.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      <span>{n.status === 'active' ? 'Active' : 'Inactive'}</span>
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => { setNodeToEdit(n); setIsAddModalOpen(true); }}
                        title="Sửa node"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setNodeToDelete(n)}
                        title="Xoá node"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddEditDnsNodeModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setNodeToEdit(null); }}
        nodeToEdit={nodeToEdit}
        onSave={handleSaveNode}
      />

      <ConfirmModal
        isOpen={!!nodeToDelete}
        title="Xoá DNS node?"
        message={`Node "${nodeToDelete?.name}" (${nodeToDelete?.ipAddress}) sẽ bị xoá vĩnh viễn khỏi danh sách. Nếu ACL đang bật, node này sẽ mất quyền truy cập Blocklist URL ngay lập tức.`}
        confirmLabel="Xoá node"
        tone="danger"
        isProcessing={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNodeToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!aclConfirmMode}
        title={aclConfirmMode === 'enable' ? 'Bật chặn ACL theo IP?' : 'Tắt chặn ACL?'}
        message={
          aclConfirmMode === 'enable'
            ? `Từ lúc này, CHỈ ${activeCount} DNS node đang Active mới gọi được Blocklist URL — mọi IP khác sẽ nhận lỗi 403. Hãy chắc chắn đã khai báo đầy đủ node thật (xem lại danh sách "IP lạ gần đây" phía trên) trước khi tiếp tục.`
            : 'Blocklist URL sẽ phục vụ mọi request như trước (không chặn IP nào) — chỉ tiếp tục ghi log các IP lạ để rà soát.'
        }
        confirmLabel={aclConfirmMode === 'enable' ? 'Bật chặn' : 'Tắt chặn'}
        tone={aclConfirmMode === 'enable' ? 'warning' : 'default'}
        isProcessing={isTogglingAcl}
        onConfirm={handleConfirmAclToggle}
        onCancel={() => setAclConfirmMode(null)}
      />
    </div>
  );
};
