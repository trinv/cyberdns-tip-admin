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
    <div className="flex-grow-1 overflow-y-auto p-3 p-sm-4 bg-body d-flex flex-column gap-4">
      {/* Header */}
      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="kpi-icon bg-primary-subtle text-primary flex-shrink-0">
              <Rocket size={18} />
            </div>
            <div>
              <h1 className="fs-5 fw-bold mb-1">Blocklist URL Đã Phát Hành</h1>
              <p className="text-body-secondary small mb-0">
                Mỗi Category có 1 URL text thuần, luôn phản ánh dữ liệu mới nhất trong CSDL — Blocky (hoặc bộ chặn DNS khác) tải định kỳ.
              </p>
            </div>
          </div>

          <button onClick={runCheckAll} className="btn btn-primary btn-sm d-flex align-items-center gap-2">
            <RefreshCw size={14} />
            <span>Kiểm tra tất cả</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ minWidth: 820 }}>
            <thead>
              <tr className="small">
                <th>Nhóm danh mục</th>
                <th>URL</th>
                <th className="text-end">Domain (CSDL)</th>
                <th>Trạng thái kiểm tra</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody className="small">
              {categories.map((cat) => {
                const url = buildBlocklistUrl(cat.id);
                const check = checks[cat.id] || { kind: 'idle' as const };
                const isCopied = copiedId === cat.id;
                return (
                  <tr key={cat.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: cat.color || '#64748b' }} />
                        <span className="fw-semibold">{cat.name}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      <code className="d-block text-truncate text-body-secondary" title={url}>{url}</code>
                    </td>
                    <td className="text-end fw-semibold font-monospace">{activeCountFor(cat.id).toLocaleString('vi-VN')}</td>
                    <td>
                      {check.kind === 'idle' && <span className="tag" style={{ background: 'var(--bs-tertiary-bg)', color: 'var(--bs-secondary-color)' }}>Chưa kiểm tra</span>}
                      {check.kind === 'checking' && <span className="tag" style={{ background: 'var(--bs-info-bg-subtle)', color: 'var(--bs-info-text-emphasis)' }}>Đang kiểm tra…</span>}
                      {check.kind === 'ok' && (
                        <div>
                          <span className="tag" style={{ background: 'var(--bs-success-bg-subtle)', color: 'var(--bs-success-text-emphasis)' }}>OK · {check.status}</span>
                          <div className="text-body-secondary font-monospace" style={{ fontSize: '0.6875rem' }}>
                            {formatBytes(check.bytes)} · {check.lines.toLocaleString('vi-VN')} dòng · {check.ms} ms · {check.checkedAt.toLocaleTimeString('vi-VN')}
                          </div>
                        </div>
                      )}
                      {check.kind === 'error' && (
                        <div>
                          <span className="tag" style={{ background: 'var(--bs-danger-bg-subtle)', color: 'var(--bs-danger-text-emphasis)' }}>Lỗi{check.status ? ` · ${check.status}` : ''}</span>
                          <div className="text-danger font-monospace" style={{ fontSize: '0.6875rem' }}>
                            {check.message} · {check.checkedAt.toLocaleTimeString('vi-VN')}
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="d-flex align-items-center justify-content-end gap-1">
                        <button onClick={() => runCheck(cat.id)} title="Kiểm tra lại" className="app-header-icon-btn" style={{ width: 28, height: 28 }}>
                          <RefreshCw size={14} className={check.kind === 'checking' ? 'spin-slow' : ''} />
                        </button>
                        <button onClick={() => handleCopy(cat.id)} title="Sao chép URL" className="app-header-icon-btn" style={{ width: 28, height: 28 }}>
                          {isCopied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </button>
                        <a href={url} target="_blank" rel="noreferrer" title="Mở URL trong tab mới" className="app-header-icon-btn" style={{ width: 28, height: 28 }}>
                          <ExternalLink size={14} />
                        </a>
                        <button onClick={() => onViewDomainsList(cat.id)} title="Xem domain của nhóm này trong Domain Explorer" className="app-header-icon-btn" style={{ width: 28, height: 28 }}>
                          <Globe2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-body-secondary">Chưa có Category nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Honest caveat: this check runs from the admin's own browser, not
          from wherever Blocky actually runs. */}
      <p className="text-body-secondary px-1 mb-0" style={{ fontSize: '0.6875rem', lineHeight: 1.6 }}>
        Kiểm tra chạy trực tiếp từ trình duyệt của bạn tới URL công khai ở trên — phản ánh đúng nội dung server đang phục vụ
        tại thời điểm kiểm tra, nhưng không đại diện cho độ trễ mạng thực tế mà Blocky (chạy ở nơi khác) sẽ thấy.
      </p>
    </div>
  );
};
