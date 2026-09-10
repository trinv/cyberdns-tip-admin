import React, { useState } from 'react';
import { AuditLog } from '../../types';
import { Search } from 'lucide-react';

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

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.reason.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Audit Logs</span>
          </h1>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo người, lý do, hành động..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all shadow-xs"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[650px]">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">THỜI GIAN</th>
                <th className="px-5 py-3.5">NGƯỜI THỰC HIỆN</th>
                <th className="px-5 py-3.5">NỘI DUNG THỰC HIỆN</th>
                <th className="px-5 py-3.5">LÝ DO (AUDIT REASON)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-700 dark:text-slate-300">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-5 py-3.5 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('vi-VN')}
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs flex-shrink-0">
                        {getInitials(log.user)}
                      </div>
                      <div>
                        <div className="text-slate-800 dark:text-slate-200 font-bold font-sans text-xs">
                          {log.user}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-sans">{log.role}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 font-sans text-slate-800 dark:text-slate-200">
                    <div className="font-semibold text-xs">{log.summary}</div>
                  </td>

                  <td
                    className="px-5 py-3.5 font-sans text-slate-500 dark:text-slate-400 max-w-xs truncate text-xs"
                    title={log.reason}
                  >
                    {log.reason}
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
