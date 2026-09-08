import React, { useState } from 'react';
import { AuditLog } from '../../types';
import { RotateCcw, Search } from 'lucide-react';

interface AuditLogsViewProps {
  logs: AuditLog[];
  onRollbackTransaction: (log: AuditLog) => Promise<void> | void;
}

// Real initials computed from the log's actual `user` string (an email or a
// role label like "Admin") — there is no avatar-photo feature in this app,
// so this replaces what used to be a hardcoded stock-photo URL rendered
// directly as text (a real, visible display bug).
function getInitials(user: string): string {
  const cleaned = user.trim();
  if (!cleaned) return '?';
  const namePart = cleaned.includes('@') ? cleaned.split('@')[0] : cleaned;
  const words = namePart.split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return namePart.slice(0, 2).toUpperCase();
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs, onRollbackTransaction }) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Tracks which single row's rollback is in flight — id-keyed so only that
  // row's button shows "Đang xử lý...", the rest of the table stays usable.
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const handleRollbackClick = async (log: AuditLog) => {
    setRollingBackId(log.id);
    try {
      await onRollbackTransaction(log);
    } finally {
      setRollingBackId(null);
    }
  };

  const filteredLogs = logs.filter((l) =>
    l.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-grow-1 overflow-y-auto p-3 p-sm-4 bg-body d-flex flex-column gap-4">
      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fs-5 fw-bold mb-1">Nhật ký thao tác &amp; Giao dịch (Audit Logs)</h1>
            <p className="text-body-secondary small mb-0">
              Ghi vết toàn bộ hành vi thêm, gỡ, đổi nhóm, allowlist và phát hành với khả năng hoàn tác tức thì (Instant Rollback).
            </p>
          </div>

          <div className="input-group input-group-sm" style={{ maxWidth: 320 }}>
            <span className="input-group-text bg-body"><Search size={14} className="text-body-secondary" /></span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo người, lý do, hành động..."
              className="form-control"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ minWidth: 650 }}>
            <thead>
              <tr className="small">
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động / Tóm tắt</th>
                <th>Quy mô</th>
                <th>Lý do (audit reason)</th>
                <th className="text-end">Hoàn tác</th>
              </tr>
            </thead>
            <tbody className="small font-monospace">
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="text-body-secondary text-nowrap">{new Date(log.timestamp).toLocaleString('vi-VN')}</td>

                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="rounded-circle bg-success-subtle text-success fw-bold d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 28, height: 28, fontSize: '0.6875rem' }}>
                        {getInitials(log.user)}
                      </div>
                      <div className="font-sans">
                        <div className="fw-bold">{log.user}</div>
                        <div className="text-body-secondary">{log.role}</div>
                      </div>
                    </div>
                  </td>

                  <td className="font-sans fw-semibold">{log.summary}</td>

                  <td className="text-success fw-bold">{log.targetCount.toLocaleString('vi-VN')} domain</td>

                  <td className="font-sans text-body-secondary text-truncate" style={{ maxWidth: 256 }} title={log.reason}>{log.reason}</td>

                  <td className="text-end">
                    {(() => {
                      const expiresAt = log.rollbackExpiresAt ? new Date(log.rollbackExpiresAt).getTime() : null;
                      const hoursLeft = expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 3600000)) : null;
                      const isExpired = hoursLeft !== null && hoursLeft <= 0;
                      // hasRollbackData === false: canRollback is true but no
                      // structured "before" state was captured for this entry
                      // (logged before this feature existed, or a feed-sync
                      // bulk add — too large to snapshot cheaply, see
                      // rollbackAuditLog). Treated the same as !canRollback
                      // rather than showing a button that would just error.
                      if (!log.canRollback || isExpired || log.hasRollbackData === false) {
                        return <span className="text-body-tertiary">—</span>;
                      }
                      const isRollingBack = rollingBackId === log.id;
                      return (
                        <button
                          onClick={() => handleRollbackClick(log)}
                          disabled={isRollingBack}
                          className="btn btn-outline-warning btn-sm d-inline-flex align-items-center gap-1"
                        >
                          <RotateCcw size={14} className={isRollingBack ? 'spin-slow' : ''} />
                          <span>{isRollingBack ? 'Đang hoàn tác...' : `Hoàn tác${hoursLeft !== null ? ` (còn ${hoursLeft}h)` : ''}`}</span>
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
