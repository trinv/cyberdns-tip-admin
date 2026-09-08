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
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Nhật ký đăng nhập (Login History)</span>
            {newIpCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800">
                {newIpCount} lần từ IP mới
              </span>
            )}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Toàn bộ lượt đăng nhập thành công và thất bại, kèm địa chỉ IP thật (qua Nginx) — dòng đánh dấu "IP MỚI" là lần đầu tài khoản đó đăng nhập thành công từ địa chỉ này.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo email, IP..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all shadow-xs"
            />
          </div>
          <button
            onClick={load}
            title="Tải lại"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer transition-colors flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start space-x-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">THỜI GIAN</th>
                <th className="px-5 py-3.5">TÀI KHOẢN</th>
                <th className="px-5 py-3.5">ĐỊA CHỈ IP</th>
                <th className="px-5 py-3.5">THIẾT BỊ / TRÌNH DUYỆT</th>
                <th className="px-5 py-3.5">KẾT QUẢ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-700 dark:text-slate-300">
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 font-sans">
                    {isLoading ? 'Đang tải...' : 'Chưa có lượt đăng nhập nào được ghi nhận.'}
                  </td>
                </tr>
              )}
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-5 py-3.5 font-sans font-semibold text-slate-800 dark:text-slate-200">{log.email}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      <span>{log.ipAddress}</span>
                      {log.success && log.isNewIp && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold font-sans bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          IP MỚI
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate font-sans" title={log.userAgent || ''}>
                    {log.userAgent || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {log.success ? (
                      <span className="inline-flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-400 font-bold font-sans">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Thành công</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center space-x-1.5 text-rose-700 dark:text-rose-400 font-bold font-sans"
                        title={log.failureReason || ''}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
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
