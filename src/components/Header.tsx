import React from 'react';
import {
  Search, Plus, Bell, ChevronDown,
  Menu, Settings, Zap, Grid, Sparkles,
  GitBranch, CheckCircle2, Shield, ArrowUpRight,
  Sun, Moon, ShieldCheck, Keyboard, HelpCircle,
  LayoutDashboard, Globe, CheckSquare, Rocket, Upload, Rss, History,
  LogIn, LogOut, UserCircle2, Users
} from 'lucide-react';
import { CyberDNSLogo } from './CyberDNSLogo';
import { AppUser } from '../types';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenSearch: () => void;
  reviewCount: number;
  currentUser: AppUser | null;
  userRole: 'Analyst' | 'Admin' | 'Reviewer';
  isAuthLoading: boolean;
  onOpenLogin: () => void;
  onSignOut: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  onOpenSearch,
  reviewCount,
  currentUser,
  userRole,
  isAuthLoading,
  onOpenLogin,
  onSignOut,
  isDarkMode,
  toggleTheme,
  onToggleSidebar,
  isSidebarCollapsed = false,
}) => {
  const [roleDropdownOpen, setRoleDropdownOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  const getTabInfo = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return { title: 'SOC Threat Dashboard', icon: LayoutDashboard, category: 'Tổng quan' };
      case 'domain':
        return { title: 'Quản trị Danh mục Tên miền (Domain Explorer)', icon: Globe, category: 'Khám phá' };
      case 'review':
        return { title: 'Hàng đợi Phê duyệt Tên miền (Review Queue)', icon: CheckSquare, category: 'Kiểm duyệt' };
      case 'release':
        return { title: 'Quản lý Bản phát hành & Cổng an toàn (Releases)', icon: Rocket, category: 'Phát hành' };
      case 'import':
        return { title: 'Nhập & Xử lý Tên miền Hàng loạt (Batch Import)', icon: Upload, category: 'Công cụ' };
      case 'sources':
        return { title: 'Nguồn Cấp Dữ liệu Tình báo Mối đe dọa (Threat Feeds)', icon: Rss, category: 'Hệ thống' };
      case 'logs':
        return { title: 'Nhật ký Kiểm toán & Khôi phục Giao dịch (Audit Logs)', icon: History, category: 'Kiểm toán' };
      case 'users':
        return { title: 'Quản lý Người dùng & Phân quyền', icon: Users, category: 'Hệ thống' };
      default:
        return { title: 'CyberDNS Console', icon: Globe, category: 'Hệ thống' };
    }
  };

  const activeTabInfo = getTabInfo(currentTab);
  const TabIcon = activeTabInfo.icon;

  return (
    <header className="w-full bg-card border-b border-border text-foreground sticky top-0 z-30 shadow-sm transition-colors duration-200">
      <div className="px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section: Sidebar toggle + Breadcrumbs & View Title */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          {/* Hamburger / Sidebar Toggle */}
          <button 
            onClick={onToggleSidebar}
            id="btn-toggle-sidebar"
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer active-press flex-shrink-0"
            title="Mở / Đóng thanh điều hướng"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb Title */}
          <div className="hidden sm:flex items-center space-x-2 min-w-0">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
              <span>CyberDNS</span>
              <span>/</span>
              <span className="text-slate-600 dark:text-slate-400 font-semibold">{activeTabInfo.category}</span>
              <span>/</span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900 dark:text-white truncate">
              <TabIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="truncate">{activeTabInfo.title}</span>
            </div>
          </div>

          {/* Mobile Title */}
          <div className="sm:hidden flex items-center space-x-1.5 text-xs font-bold text-slate-900 dark:text-white truncate">
            <TabIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="truncate">{activeTabInfo.title.split('(')[0]}</span>
          </div>

          {/* Quick Search Box */}
          <div 
            onClick={onOpenSearch}
            className="hidden md:flex relative max-w-xs w-64 cursor-pointer group ml-2"
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              readOnly
              placeholder="Tìm domain, IP, ASN..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-100/90 dark:bg-slate-800/80 hover:bg-slate-200/60 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl border border-slate-200/60 dark:border-slate-700/60 transition-all outline-none cursor-pointer"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-300 font-mono shadow-xs border border-slate-200 dark:border-slate-600">⌘K</kbd>
            </div>
          </div>
        </div>

        {/* Right Section: Release status, Quick Add, Theme, Shortcuts, Notifications, User Profile */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 flex-shrink-0">
          {/* Theme Toggle Button (Light / Dark) */}
          <button
            onClick={toggleTheme}
            id="btn-toggle-theme"
            title={isDarkMode ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer active-press"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative cursor-pointer active-press"
              title="Thông báo"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">
                {reviewCount > 0 ? reviewCount : 4}
              </span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 py-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 pb-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 dark:text-white font-sans">Thông báo SOC</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                    4 Mới
                  </span>
                </div>
                <div className="py-2 divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-72 overflow-y-auto">
                  <div 
                    onClick={() => { setCurrentTab('review'); setNotificationsOpen(false); }}
                    className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200 font-sans">14 tên miền chờ duyệt khẩn</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Phát hiện từ crawler VNCERT và Báo cáo cộng đồng</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">10 phút trước</div>
                  </div>
                  <div 
                    onClick={() => { setCurrentTab('release'); setNotificationsOpen(false); }}
                    className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200 font-sans">Bản phát hành v2026.0822 sẵn sàng</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bao gồm 83 domain cờ bạc và lừa đảo mới</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">1 giờ trước</div>
                  </div>
                  <div 
                    onClick={() => { setCurrentTab('sources'); setNotificationsOpen(false); }}
                    className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-200 font-sans">Nguồn PhishTank hoàn tất quét</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">+4.210 domain mới được phân loại tự động</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono">2 giờ trước</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden sm:block mx-1"></div>

          {/* User Profile — self-hosted email/password session */}
          {!currentUser ? (
            <button
              onClick={onOpenLogin}
              disabled={isAuthLoading}
              className="flex items-center space-x-1.5 pl-3 pr-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 active-press"
              title="Đăng nhập để thực hiện các thao tác ghi (thêm/sửa domain, phát hành, v.v.)"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="flex items-center space-x-2 pl-1.5 pr-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200/60 dark:border-slate-700/60 transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden border border-emerald-500/40 bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName || 'User avatar'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-xs leading-tight font-sans tracking-tight truncate max-w-[120px]">
                    {currentUser.displayName || currentUser.email}
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold leading-tight">{userRole}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white font-sans truncate">
                      {currentUser.displayName || 'Người dùng'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5 truncate">{currentUser.email}</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">Vai trò: {userRole}</div>
                  </div>
                  {userRole === 'Admin' && (
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        setCurrentTab('users');
                      }}
                      className="w-full text-left px-4 py-2 text-xs flex items-center space-x-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Quản lý người dùng</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-4 py-2 text-xs flex items-center space-x-2 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer text-red-600 dark:text-red-400 border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
