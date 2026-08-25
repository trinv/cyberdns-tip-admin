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
    <div className="h-screen w-screen overflow-y-auto bg-white dark:bg-[#0B1120] flex flex-col lg:flex-row transition-colors">
      {/* Left: brand panel */}
      <div className="relative lg:w-1/2 xl:w-[55%] flex-shrink-0 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 dark:from-[#060a14] dark:via-[#060a14] dark:to-emerald-950 text-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 min-h-[280px] lg:min-h-0">
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }} />

        <div className="relative">
          <CyberDNSLogo size={40} showText textClassName="text-2xl" glow />
        </div>

        <div className="relative space-y-5 py-10 lg:py-0">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Lá chắn an toàn<br />trên không gian mạng
          </h1>
          <p className="text-slate-300 text-sm max-w-md leading-relaxed">
            An toàn hơn trên Internet, bắt đầu từ DNS. Cổng quản trị Threat Intelligence Platform — đồng bộ nguồn feed, phân loại danh mục, kiểm duyệt và phát hành danh sách chặn có kiểm soát.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4 max-w-md">
            <div className="flex flex-col items-start space-y-2">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs text-slate-300 leading-snug">Đồng bộ nguồn feed thời gian thực</span>
            </div>
            <div className="flex flex-col items-start space-y-2">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs text-slate-300 leading-snug">Kiểm duyệt &amp; phân loại danh mục</span>
            </div>
            <div className="flex flex-col items-start space-y-2">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-xs text-slate-300 leading-snug">Kiểm soát truy cập theo vai trò</span>
            </div>
          </div>
        </div>

        <div className="relative text-xs text-slate-400">
          © CyberDNS. All rights reserved. ·{' '}
          <a href="https://cyberdns.vn" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors underline decoration-slate-600">
            cyberdns.vn
          </a>
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <button
          onClick={toggleTheme}
          title={isDarkMode ? 'Chế độ sáng' : 'Chế độ tối'}
          className="absolute top-5 right-5 sm:top-8 sm:right-8 p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-sm space-y-7">
          {/* Matches every other page's header pattern (see e.g.
              SourcesView/AuditLogsView/ReviewQueueView's <h1>) — this used
              to be text-xl/text-sm, one step larger than the rest of the
              app uses for a page title + subtitle. */}
          <div className="space-y-1">
            <h2 className="text-lg font-bold font-sans text-slate-900 dark:text-white">Đăng nhập</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs">Truy cập CyberDNS Threat Intelligence Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start space-x-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl px-3.5 py-2.5 text-xs font-medium">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">EMAIL</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cyberdns.vn"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/60 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">MẬT KHẨU</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl px-3.5 py-2 pr-10 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/60 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm shadow-emerald-600/20 active-press disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 dark:text-slate-600">
            Cần tài khoản? Liên hệ quản trị viên hệ thống của bạn để được cấp quyền truy cập.
          </p>
        </div>
      </div>
    </div>
  );
};
