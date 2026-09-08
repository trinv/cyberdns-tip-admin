import React, { useState } from 'react';
import { AppUser } from '../../types';
import { UserPlus, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react';

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
    <div className="flex-grow-1 overflow-y-auto p-3 p-sm-4 bg-body d-flex flex-column gap-4">
      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fs-5 fw-bold mb-1">Quản lý người dùng &amp; phân quyền</h1>
            <p className="text-body-secondary small mb-0">
              Tạo tài khoản mới, đổi vai trò, hoặc thu hồi quyền truy cập. Chỉ Admin mới thấy trang này.
            </p>
          </div>
          <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary d-flex align-items-center gap-2">
            <UserPlus size={16} />
            <span>Tạo tài khoản mới</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ minWidth: 700 }}>
            <thead>
              <tr className="small">
                <th>Email / Tên hiển thị</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody className="small">
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-body-secondary">
                    Chưa có dữ liệu — đang tải hoặc chưa có tài khoản nào ngoài tài khoản của bạn.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="fw-bold font-monospace">{u.email}</div>
                      <div className="text-body-secondary">
                        {u.displayName || '—'} {isSelf && <span className="text-primary fw-semibold">(bạn)</span>}
                      </div>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => onUpdateUser(u.id, { role: e.target.value })}
                        disabled={!u.isActive}
                        className="form-select form-select-sm fw-bold text-primary"
                        style={{ width: 'auto' }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {u.isActive ? (
                        <span className="badge rounded-pill text-bg-success-subtle text-success">Đang hoạt động</span>
                      ) : (
                        <span className="badge rounded-pill text-bg-secondary-subtle text-secondary">Đã thu hồi</span>
                      )}
                    </td>
                    <td className="text-body-secondary font-monospace">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td>
                      <div className="d-flex align-items-center justify-content-end gap-1">
                        <button
                          onClick={() => setResetPasswordFor(resetPasswordFor === u.id ? null : u.id)}
                          title="Đặt lại mật khẩu"
                          className="app-header-icon-btn"
                          style={{ width: 28, height: 28 }}
                        >
                          <KeyRound size={14} />
                        </button>
                        {u.isActive ? (
                          <button
                            onClick={() => onUpdateUser(u.id, { isActive: false })}
                            title="Thu hồi tài khoản"
                            className="app-header-icon-btn"
                            style={{ width: 28, height: 28 }}
                          >
                            <ShieldOff size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateUser(u.id, { isActive: true })}
                            title="Kích hoạt lại"
                            className="app-header-icon-btn"
                            style={{ width: 28, height: 28 }}
                          >
                            <ShieldCheck size={14} />
                          </button>
                        )}
                      </div>

                      {resetPasswordFor === u.id && (
                        <form onSubmit={(e) => handleResetPasswordSubmit(e, u.id)} className="d-flex align-items-center gap-1 justify-content-end mt-2">
                          <input
                            type="password"
                            required
                            autoFocus
                            placeholder="Mật khẩu mới"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="form-control form-control-sm"
                            style={{ width: 128 }}
                          />
                          <button type="submit" className="btn btn-primary btn-sm">Lưu</button>
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
        <>
          <div className="modal-backdrop fade show" />
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-6 fw-bold">Tạo tài khoản mới</h2>
                  <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-close" />
                </div>
                <form onSubmit={handleCreateSubmit}>
                  <div className="modal-body d-flex flex-column gap-3">
                    <div>
                      <label className="form-label small fw-bold">Email</label>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="form-control" />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Mật khẩu tạm thời</label>
                      <input
                        type="text"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Gửi thủ công cho người dùng"
                        className="form-control font-monospace"
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Tên hiển thị</label>
                      <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="form-control" />
                    </div>
                    <div>
                      <label className="form-label small fw-bold">Vai trò</label>
                      <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className="form-select">
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" onClick={() => setIsCreateOpen(false)} className="btn btn-light border">Hủy</button>
                    <button type="submit" className="btn btn-primary">Tạo tài khoản</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
