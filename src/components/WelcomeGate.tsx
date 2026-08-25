import React from 'react';
import { LogIn, ShieldCheck, Globe, CheckSquare } from 'lucide-react';
import { CyberDNSLogo } from './CyberDNSLogo';

interface WelcomeGateProps {
  onOpenLogin: () => void;
}

// Shown instead of the app shell whenever no one is signed in — a visitor
// (or a bot) hitting the bare URL should see what this system is and a
// clear way to sign in, not land straight inside the SOC dashboard with
// real domain/threat data on screen before authenticating.
export const WelcomeGate: React.FC<WelcomeGateProps> = ({ onOpenLogin }) => {
  return (
    <div className="h-screen w-screen overflow-y-auto bg-[#f8fafc] dark:bg-[#0B1120] flex items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <CyberDNSLogo size={56} glow />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white font-sans tracking-tight">
              CyberDNS Threat Intelligence Platform
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hệ thống quản lý danh sách chặn DNS &amp; tình báo mối đe dọa — đồng bộ nguồn feed, phân loại danh mục, kiểm duyệt và phát hành có kiểm soát.
            </p>
          </div>

          <button
            onClick={onOpenLogin}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm shadow-emerald-600/20 active-press"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập vào hệ thống</span>
          </button>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-col items-center space-y-1.5">
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Đồng bộ nguồn feed</span>
            </div>
            <div className="flex flex-col items-center space-y-1.5">
              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Kiểm duyệt &amp; phân loại</span>
            </div>
            <div className="flex flex-col items-center space-y-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Kiểm soát truy cập</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-4">
          Cần tài khoản? Liên hệ quản trị viên hệ thống của bạn để được cấp quyền truy cập.
        </p>
      </div>
    </div>
  );
};
