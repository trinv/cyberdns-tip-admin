import React, { useEffect, useState } from 'react';
import { LoginLog } from '../../types';
import { fetchLoginLogs } from '../../lib/api';
import { ShieldCheck, ShieldAlert, MapPin, Search, RefreshCw, AlertTriangle } from 'lucide-react';

// Admin-only screen (see the 'login-logs' Sidebar item's Admin gate and
// GET /api/login-logs' requireRole('Admin')) showing every real login
// attempt — success and failure — with the real client IP/User-Agent
// (see recordLoginAttempt in queries.ts and server.ts's `trust proxy`
// setting). Rows flagged isNewIp are the same signal the login response
// itself surfaces as an immediate warning to the user who just signed in.
export const LoginHistoryView: React.FC = () => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const load = () => {
    setIsLoading(true);
    setError(null);
    fetchLoginLogs()
      .then(setLogs)
      .catch((err) => setError(err?.message || 'Không thể tải nhật ký đăng nhập.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const newIpCount = logs.filter((l) => l.success && l.isNewIp).length;

  return (
    <div className="flex-grow-1 overflow-y-auto p-3 p-sm-4 bg-body d-flex flex-column gap-4">
      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fs-5 fw-bold mb-1 d-flex align-items-center gap-2">
              <span>Nhật ký đăng nhập (Login History)</span>
              {newIpCount > 0 && (
                <span className="badge rounded-pill text-bg-warning-subtle text-warning-emphasis">{newIpCount} lần từ IP mới</span>
              )}
            </h1>
            <p className="text-body-secondary small mb-0">
              Toàn bộ lượt đăng nhập thành công và thất bại, kèm địa chỉ IP thật (qua Nginx) — dòng đánh dấu "IP MỚI" là lần đầu tài khoản đó đăng nhập thành công từ địa chỉ này.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="input-group input-group-sm" style={{ maxWidth: 256 }}>
              <span className="input-group-text bg-body"><Search size={14} className="text-body-secondary" /></span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo email, IP..."
                className="form-control"
              />
            </div>
            <button onClick={load} title="Tải lại" className="app-header-icon-btn rounded-2 bg-body-tertiary flex-shrink-0">
              <RefreshCw size={16} className={isLoading ? 'spin-slow' : ''} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2 mb-0">
          <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ minWidth: 700 }}>
            <thead>
              <tr className="small">
                <th>Thời gian</th>
                <th>Tài khoản</th>
                <th>Địa chỉ IP</th>
                <th>Thiết bị / Trình duyệt</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody className="small font-monospace">
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-body-secondary font-sans">
                    {isLoading ? 'Đang tải...' : 'Chưa có lượt đăng nhập nào được ghi nhận.'}
                  </td>
                </tr>
              )}
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="text-body-secondary text-nowrap">{new Date(log.createdAt).toLocaleString('vi-VN')}</td>
                  <td className="font-sans fw-semibold">{log.email}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <MapPin size={14} className="text-body-secondary flex-shrink-0" />
                      <span>{log.ipAddress}</span>
                      {log.success && log.isNewIp && (
                        <span className="badge text-bg-warning-subtle text-warning-emphasis font-sans">IP MỚI</span>
                      )}
                    </div>
                  </td>
                  <td className="text-body-secondary text-truncate font-sans" style={{ maxWidth: 288 }} title={log.userAgent || ''}>
                    {log.userAgent || '—'}
                  </td>
                  <td>
                    {log.success ? (
                      <span className="d-inline-flex align-items-center gap-2 text-success fw-bold font-sans">
                        <ShieldCheck size={14} />
                        <span>Thành công</span>
                      </span>
                    ) : (
                      <span className="d-inline-flex align-items-center gap-2 text-danger fw-bold font-sans" title={log.failureReason || ''}>
                        <ShieldAlert size={14} />
                        <span>Thất bại</span>
                      </span>
                    )}
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
