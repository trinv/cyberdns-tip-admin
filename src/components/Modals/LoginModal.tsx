import React, { useState } from 'react';
import { LogIn, ShieldAlert } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onLogin(email.trim(), password);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-6 fw-bold d-flex align-items-center gap-2">
                <LogIn size={16} className="text-primary" />
                <span>Đăng nhập CyberDNS TIP</span>
              </h2>
              <button onClick={onClose} className="btn-close" />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body d-flex flex-column gap-3">
                {error && (
                  <div className="alert alert-danger d-flex align-items-start gap-2 mb-0">
                    <ShieldAlert size={16} className="flex-shrink-0 mt-1" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="form-label small fw-bold">Email</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@cyberdns.vn"
                    className="form-control"
                  />
                </div>

                <div>
                  <label className="form-label small fw-bold">Mật khẩu</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="form-control"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="btn btn-light border">Hủy</button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
