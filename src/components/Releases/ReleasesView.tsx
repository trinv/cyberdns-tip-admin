import React, { useCallback, useState } from 'react';
import { CategoryInfo, DashboardStats } from '../../types';
import { buildBlocklistUrl } from '../../lib/blocklistUrl';
import { copyToClipboard } from '../../lib/clipboard';
import { Check, Copy, ExternalLink, Globe2, RefreshCw, Rocket } from 'lucide-react';

interface ReleasesViewProps {
  categories: CategoryInfo[];
  // Live aggregates from GET /api/dashboard/stats — same source Dashboard
  // uses, so the "Domain (CSDL)" column here always matches what the
  // Dashboard shows for the same category.
  stats: DashboardStats | null;
  onViewDomainsList: (category: string) => void;
}

// One row's live health-check result. 'idle' until the user (or "Kiểm tra
// tất cả") triggers a check — never auto-fabricated, never pre-filled.
type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; status: number; bytes: number; lines: number; ms: number; checkedAt: Date }
  | { kind: 'error'; status?: number; message: string; ms: number; checkedAt: Date };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Real, live check — fetches the actual public URL from the admin's own
// browser (same path Blocky itself would poll, minus Blocky's own network
// hop) and reads real numbers back from the response: no simulated
// progress bar, no fabricated percentages. `cache: 'no-store'` so a stale
// browser cache never reports a check that didn't really happen just now.
async function checkBlocklistUrl(url: string): Promise<CheckState> {
  const start = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    const ms = Math.round(performance.now() - start);
    const checkedAt = new Date();
    const trimmed = text.trim();
    const lines = trimmed.length === 0 ? 0 : trimmed.split('\n').length;
    const contentLengthHeader = res.headers.get('content-length');
    const bytes = contentLengthHeader ? Number(contentLengthHeader) : new Blob([text]).size;
    if (!res.ok) {
      return { kind: 'error', status: res.status, message: `HTTP ${res.status}`, ms, checkedAt };
    }
    return { kind: 'ok', status: res.status, bytes, lines, ms, checkedAt };
  } catch (err: any) {
    return {
      kind: 'error',
      message: err?.message || 'Không kết nối được',
      ms: Math.round(performance.now() - start),
      checkedAt: new Date(),
    };
  }
}

export const ReleasesView: React.FC<ReleasesViewProps> = ({ categories, stats, onViewDomainsList }) => {
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // categoryBreakdown only ever contains categories with ≥1 active domain
  // right now (a GROUP BY query — see getDashboardStats in queries.ts), so
  // a category absent from it genuinely has 0, not "unknown".
  const activeCountFor = (categoryId: string): number =>
    stats?.categoryBreakdown.find((c) => c.category === categoryId)?.count ?? 0;

  const runCheck = useCallback(async (categoryId: string) => {
    setChecks((prev) => ({ ...prev, [categoryId]: { kind: 'checking' } }));
    const result = await checkBlocklistUrl(buildBlocklistUrl(categoryId));
    setChecks((prev) => ({ ...prev, [categoryId]: result }));
  }, []);

  const runCheckAll = useCallback(() => {
    // Fire all checks in parallel — each independently updates its own row
    // via runCheck's own setChecks call, so one slow/failed URL never
    // blocks or breaks the others (no Promise.all rejection cascade).
    categories.forEach((cat) => {
      runCheck(cat.id);
    });
  }, [categories, runCheck]);

  const handleCopy = async (categoryId: string) => {
    const ok = await copyToClipboard(buildBlocklistUrl(categoryId));
    if (ok) {
      setCopiedId(categoryId);
      setTimeout(() => setCopiedId((cur) => (cur === categoryId ? null : cur)), 1500);
    }
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white">
              Blocklist URL Đã Phát Hành
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Mỗi Category có 1 URL text thuần, luôn phản ánh dữ liệu mới nhất trong CSDL — Blocky (hoặc bộ
              chặn DNS khác) tải định kỳ.
            </p>
          </div>
        </div>

        <button
          onClick={runCheckAll}
          className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-2 cursor-pointer active-press"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Kiểm tra tất cả</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3">NHÓM DANH MỤC</th>
                <th className="px-5 py-3">URL</th>
                <th className="px-5 py-3 text-right">DOMAIN (CSDL)</th>
                <th className="px-5 py-3">TRẠNG THÁI KIỂM TRA</th>
                <th className="px-5 py-3 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {categories.map((cat) => {
                const url = buildBlocklistUrl(cat.id);
                const check = checks[cat.id] || { kind: 'idle' as const };
                const isCopied = copiedId === cat.id;
                return (
                  <tr
                    key={cat.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color || '#64748b' }}
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-[260px]">
                      <code
                        className="block truncate text-slate-500 dark:text-slate-400 font-mono text-xs"
                        title={url}
                      >
                        {url}
                      </code>
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                      {activeCountFor(cat.id).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-5 py-3">
                      {check.kind === 'idle' && (
                        <span
                          className="tag"
                          style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                        >
                          Chưa kiểm tra
                        </span>
                      )}
                      {check.kind === 'checking' && <span className="tag t-info">Đang kiểm tra…</span>}
                      {check.kind === 'ok' && (
                        <div className="space-y-0.5">
                          <span className="tag t-active">OK · {check.status}</span>
                          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            {formatBytes(check.bytes)} · {check.lines.toLocaleString('vi-VN')} dòng ·{' '}
                            {check.ms} ms · {check.checkedAt.toLocaleTimeString('vi-VN')}
                          </div>
                        </div>
                      )}
                      {check.kind === 'error' && (
                        <div className="space-y-0.5">
                          <span className="tag t-unavail">Lỗi{check.status ? ` · ${check.status}` : ''}</span>
                          <div className="text-[11px] font-mono text-rose-500 dark:text-rose-400">
                            {check.message} · {check.checkedAt.toLocaleTimeString('vi-VN')}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => runCheck(cat.id)}
                          title="Kiểm tra lại"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${check.kind === 'checking' ? 'animate-spin' : ''}`}
                          />
                        </button>
                        <button
                          onClick={() => handleCopy(cat.id)}
                          title="Sao chép URL"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          title="Mở URL trong tab mới"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => onViewDomainsList(cat.id)}
                          title="Xem domain của nhóm này trong Domain Explorer"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Globe2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400 dark:text-slate-500">
                    Chưa có Category nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Honest caveat: this check runs from the admin's own browser, not
          from wherever Blocky actually runs — see the plan's rationale. */}
      <p className="text-[11px] text-slate-400 dark:text-slate-600 leading-relaxed px-1">
        Kiểm tra chạy trực tiếp từ trình duyệt của bạn tới URL công khai ở trên — phản ánh đúng nội dung
        server đang phục vụ tại thời điểm kiểm tra, nhưng không đại diện cho độ trễ mạng thực tế mà Blocky
        (chạy ở nơi khác) sẽ thấy.
      </p>
    </div>
  );
};
