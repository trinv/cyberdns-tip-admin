import React, { useState } from 'react';
import { AppUser } from '../../types';
import { UserPlus, ShieldCheck, ShieldOff, KeyRound, X } from 'lucide-react';

interface UserManagementViewProps {
  users: AppUser[];
  currentUserId: number | null;
  onCreateUser: (data: { email: string; password: string; displayName?: string; role?: string }) => Promise<void>;
  onUpdateUser: (
    id: number,
    patch: { role?: string; isActive?: boolean; displayName?: string; password?: string }
  ) => Promise<void>;
}

const ROLES = ['Analyst', 'Reviewer', 'Admin'] as const;

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUserId,
  onCreateUser,
  onUpdateUser,
}) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('Analyst');
  const [resetPasswordFor, setResetPasswordFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    await onCreateUser({ email: email.trim(), password, displayName: displayName.trim() || undefined, role });
    setEmail('');
    setPassword('');
    setDisplayName('');
    setRole('Analyst');
    setIsCreateOpen(false);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    if (!newPassword) return;
    await onUpdateUser(id, { password: newPassword });
    setNewPassword('');
    setResetPasswordFor(null);
  };

  return (
    <div className="flex-1 bg-[#f8fafc] dark:bg-[#0B1120] overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 dark:text-slate-300 text-xs transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <h1 className="text-lg font-bold font-sans text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Quản lý người dùng & phân quyền</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Tạo tài khoản mới, đổi vai trò, hoặc thu hồi quyền truy cập. Chỉ Admin mới thấy trang này.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active-press"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tạo tài khoản mới</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">EMAIL / TÊN HIỂN THỊ</th>
                <th className="px-4 py-3">VAI TRÒ</th>
                <th className="px-4 py-3">TRẠNG THÁI</th>
                <th className="px-4 py-3">NGÀY TẠO</th>
                <th className="px-4 py-3 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    Chưa có dữ liệu — đang tải hoặc chưa có tài khoản nào ngoài tài khoản của bạn.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">{u.email}</div>
                      <div className="text-slate-400 dark:text-slate-500">
                        {u.displayName || '—'} {isSelf && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">(bạn)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => onUpdateUser(u.id, { role: e.target.value })}
                        disabled={!u.isActive}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none focus:border-emerald-500 disabled:opacity-50 cursor-pointer"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>Đang hoạt động</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span>Đã thu hồi</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setResetPasswordFor(resetPasswordFor === u.id ? null : u.id)}
                          title="Đặt lại mật khẩu"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {u.isActive ? (
                          <button
                            onClick={() => onUpdateUser(u.id, { isActive: false })}
                            title="Thu hồi tài khoản"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateUser(u.id, { isActive: true })}
                            title="Kích hoạt lại"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {resetPasswordFor === u.id && (
                        <form
                          onSubmit={(e) => handleResetPasswordSubmit(e, u.id)}
                          className="mt-2 flex items-center space-x-1.5 justify-end"
                        >
                          <input
                            type="password"
                            required
                            autoFocus
                            placeholder="Mật khẩu mới"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-32"
                          />
                          <button
                            type="submit"
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                          >
                            Lưu
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-sans">Tạo tài khoản mới</h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-3.5">
              <div className="space-y-1">
                <label className="block text-slate-800 dark:text-slate-200 font-bold text-xs">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-800 dark:text-slate-200 font-bold text-xs">Mật khẩu tạm thời</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Gửi thủ công cho người dùng"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-800 dark:text-slate-200 font-bold text-xs">Tên hiển thị</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-800 dark:text-slate-200 font-bold text-xs">Vai trò</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active-press"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
