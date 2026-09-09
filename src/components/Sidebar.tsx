import React from 'react';
import {
  LayoutDashboard, Globe, CheckSquare, Rocket, Upload,
  Rss, History, SlidersHorizontal, ArrowUpRight, X,
  Sun, Moon, ShieldCheck, Sparkles, ChevronLeft, ChevronRight,
  Shield, Server, Activity, Bell, Users, UserCircle2
} from 'lucide-react';
import { CyberDNSLogo } from './CyberDNSLogo';
import { AppUser } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser?: AppUser | null;
  userRole?: 'Analyst' | 'Admin' | 'Reviewer';
  isDarkMode?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  // No longer rendered here — the "Công cụ điều khiển" quick-actions block
  // (Search/Thêm tên miền/Phím tắt buttons) was removed per explicit
  // request. Kept optional in this interface (rather than also editing
  // App.tsx's call site). onOpenSearch/onOpenShortcuts stay reachable via
  // their existing global keyboard shortcuts (Ctrl+K, '?' — see App.tsx),
  // so those two lost nothing functionally. onOpenAddDomain did NOT have
  // an equivalent anywhere else in the app — see the chat response this
  // change shipped with.
  onOpenAddDomain?: () => void;
  onOpenShortcuts?: () => void;
  onOpenSearch?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  currentUser = null,
  userRole = 'Analyst',
  isDarkMode = false,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const handleNavClick = (tab: string) => {
    setCurrentTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navItems = [
    {
      group: 'TỔNG QUAN',
      items: [
        { id: 'dashboard', label: 'SOC Dashboard', icon: LayoutDashboard },
      ]
    },
    {
      group: 'THREAT INTELLIGENCE',
      items: [
        { id: 'domain', label: 'Domain Explorer', icon: Globe },
        { id: 'sources', label: 'Nguồn Threat Feeds', icon: Rss },
      ]
    },
    {
      group: 'KIỂM DUYỆT & XỬ LÝ',
      items: [
        { id: 'import', label: 'Import dữ liệu', icon: Upload },
        { id: 'review', label: 'Hàng đợi duyệt', icon: CheckSquare },
        { id: 'release', label: 'DNS Blocklist URL', icon: Rocket },
      ]
    },
    {
      group: 'HẠ TẦNG',
      items: [
        ...(userRole === 'Admin' ? [{ id: 'dns-nodes', label: 'Quản lý DNS Node', icon: Server }] : []),
      ]
    },
    {
      group: 'NHẬT KÝ & GIÁM SÁT',
      items: [
        { id: 'logs', label: 'Nhật ký Audit', icon: History },
        ...(userRole === 'Admin' ? [{ id: 'login-logs', label: 'Nhật ký đăng nhập', icon: ShieldCheck }] : []),
      ]
    },
    {
      group: 'QUẢN TRỊ TÀI KHOẢN',
      items: [
        ...(userRole === 'Admin' ? [{ id: 'users', label: 'Người dùng & Phân quyền', icon: Users }] : []),
      ]
    },
    // Groups that end up with zero items for the current role (HẠ TẦNG /
    // QUẢN TRỊ TÀI KHOẢN are entirely Admin-gated) are filtered out below,
    // right before rendering — otherwise a non-Admin would see an empty
    // group heading with nothing under it.
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
        />
      )}

      {/* Main Sidebar Container */}
      <aside 
        className={`
          bg-card border-r border-border 
          flex flex-col h-full select-none flex-shrink-0 z-50
          transition-all duration-300 ease-in-out
          fixed md:relative top-0 bottom-0 left-0
          ${isMobileOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-[72px]' : 'md:w-[260px]'}
        `}
      >
        {/* Brand Header with CyberDNS Logo */}
        <div className={`h-16 px-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-slate-100 dark:border-slate-800/80`}>
          <div 
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="CyberDNS Category Manager"
          >
            <CyberDNSLogo size={32} showText={!isCollapsed} glow={isDarkMode} />
          </div>

          {/* Close button for Mobile Drawer */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card — real signed-in account, or a neutral "signed
            out" state (this app has no Google/photo avatar anymore — see
            src/middleware/auth.ts, self-hosted email/password only). */}
        <div className={`p-3 border-b border-slate-100 dark:border-slate-800/80 ${isCollapsed ? 'flex justify-center' : ''}`}>
          {isCollapsed ? (
            <div className="relative cursor-pointer group p-1" title={currentUser ? `${currentUser.email} — ${userRole}` : 'Chưa đăng nhập'}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm overflow-hidden ring-2 ring-emerald-500/20 group-hover:ring-emerald-500">
                <UserCircle2 className="w-7 h-7" />
              </div>
              {currentUser && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-900"></span>}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-2.5 flex items-center justify-between transition-colors">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm overflow-hidden ring-2 ring-emerald-500/20">
                    <UserCircle2 className="w-5 h-5" />
                  </div>
                  {currentUser && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-slate-800"></span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {currentUser ? currentUser.displayName || currentUser.email : 'Chưa đăng nhập'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate flex items-center space-x-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                    <span>{currentUser ? userRole : 'Chỉ xem'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4 text-xs font-medium scrollbar-thin">
          {navItems.filter((sec) => sec.items.length > 0).map((sec, secIdx) => (
            <div key={secIdx}>
              {!isCollapsed && (
                <div className="px-3 mb-1.5 mt-6 first:mt-0 text-xs font-bold text-slate-400 dark:text-slate-500 tracking-[.06em] uppercase">
                  {sec.group}
                </div>
              )}
              <div className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center rounded-md transition-all cursor-pointer group relative min-h-11
                        ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'}
                        ${
                          isActive
                            ? 'bg-primary-soft text-primary font-semibold shadow-[inset_3px_0_0_var(--color-primary)]'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                        {!isCollapsed && (
                          <span className="truncate text-xs">{item.label}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Area: Collapse Toggle
            (there used to be a "DNS Edge Anycast / 16 PoPs" status card
            here — this app doesn't operate any real edge DNS resolver
            network, so that was purely decorative/fabricated infrastructure
            copy and was removed rather than left implying a capability that
            doesn't exist.) */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          {/* Desktop sidebar collapse toggle */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-end'}`}>
            {/* Desktop Collapse Button */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title={isCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
                className="hidden md:flex p-2 w-full justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 transition-colors cursor-pointer flex-shrink-0"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
