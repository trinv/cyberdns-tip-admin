import React, { useState } from 'react';
import { LogIn, ShieldAlert, Globe, CheckSquare, ShieldCheck, Sun, Moon, Eye, EyeOff } from 'lucide-react';
import { CyberDNSLogo } from './CyberDNSLogo';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

// The sign-in gate for the whole app (see App.tsx: nothing else renders
// until currentUser is set) — a dedicated full-page split layout instead of
// a "click through a landing page, then a modal pops up" flow, matching the
// branding of cyberdns.vn (tagline, "© CyberDNS" copyright) since this IS
// CyberDNS' own admin console.
export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isDarkMode, toggleTheme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onLogin(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="vh-100 vw-100 overflow-y-auto d-flex flex-column flex-lg-row bg-body">
      {/* Left: brand panel — always dark regardless of the app's light/dark
          toggle (see CyberDNSLogo's variant="dark" below: with the default
          "auto" variant, switching the app to light mode would render
          "Cyber" in near-black text sitting on this permanently-dark panel,
          unreadable). */}
      <div
        className="position-relative flex-shrink-0 text-white d-flex flex-column justify-content-between p-4 p-sm-5 p-lg-5"
        style={{
          width: '100%',
          minHeight: 280,
          background: 'linear-gradient(135deg, #0f172a 0%, #0f172a 55%, #052e16 100%)',
        }}
      >
        <div
          className="position-absolute top-0 start-0 end-0 bottom-0"
          style={{
            opacity: 0.07,
            pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="position-relative">
          <CyberDNSLogo size={40} showText textClassName="fs-3" glow variant="dark" />
        </div>

        <div className="position-relative py-4 py-lg-0" style={{ maxWidth: 480 }}>
          <h1 className="fw-bold" style={{ fontSize: '2rem', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Lá chắn an toàn<br />trên không gian mạng
          </h1>
          <p className="mt-3 mb-0 small" style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
            An toàn hơn trên Internet, bắt đầu từ DNS. Cổng quản trị Threat Intelligence Platform — đồng bộ nguồn feed, phân loại danh mục, kiểm duyệt và phát hành danh sách chặn có kiểm soát.
          </p>

          <div className="row g-3 mt-3">
            {[
              { Icon: Globe, label: 'Đồng bộ nguồn feed thời gian thực' },
              { Icon: CheckSquare, label: 'Kiểm duyệt & phân loại danh mục' },
              { Icon: ShieldCheck, label: 'Kiểm soát truy cập theo vai trò' },
            ].map(({ Icon, label }) => (
              <div className="col-4" key={label}>
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center mb-2"
                  style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)' }}
                >
                  <Icon size={16} style={{ color: '#6ee7b7' }} />
                </div>
                <span className="small" style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="position-relative small" style={{ color: 'rgba(255,255,255,0.6)' }}>
          © CyberDNS. All rights reserved. ·{' '}
          <a href="https://cyberdns.vn" target="_blank" rel="noreferrer" className="link-light">
            cyberdns.vn
          </a>
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="flex-grow-1 d-flex align-items-center justify-content-center p-4 p-sm-5 position-relative">
        <button
          onClick={toggleTheme}
          title={isDarkMode ? 'Chế độ sáng' : 'Chế độ tối'}
          className="app-header-icon-btn position-absolute"
          style={{ top: 20, right: 20 }}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="w-100" style={{ maxWidth: 384 }}>
          <div className="mb-4">
            <h2 className="fw-bold fs-5 mb-1">Đăng nhập</h2>
            <p className="text-body-secondary small mb-0">Truy cập CyberDNS Threat Intelligence Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
            {error && (
              <div className="alert alert-danger d-flex align-items-start gap-2 py-2 px-3 small mb-0">
                <ShieldAlert size={16} className="flex-shrink-0 mt-1" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="form-label small fw-bold">EMAIL</label>
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
              <label className="form-label small fw-bold">MẬT KHẨU</label>
              <div className="position-relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-control"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-body-secondary p-0 me-3"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn btn-primary fw-bold d-flex align-items-center justify-content-center gap-2">
              <LogIn size={16} />
              <span>{isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
            </button>
          </form>

          <p className="text-center text-body-secondary small mt-4 mb-0">
            Cần tài khoản? Liên hệ quản trị viên hệ thống của bạn để được cấp quyền truy cập.
          </p>
        </div>
      </div>
    </div>
  );
};
