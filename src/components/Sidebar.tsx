import React from 'react';
import {
  LayoutDashboard, Globe, CheckSquare, Rocket, Upload,
  Rss, History, SlidersHorizontal, ArrowUpRight, X,
  Sun, Moon, ShieldCheck, Sparkles, ChevronLeft, ChevronRight,
  Shield, Server, Activity, Plus, Search, Bell, Keyboard, Users, UserCircle2
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
  onOpenAddDomain,
  onOpenShortcuts,
  onOpenSearch,
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
        { id: 'domain', label: 'Domain Explorer', icon: Globe },
      ]
    },
    {
      group: 'QUY TRÌNH & DUYỆT',
      items: [
        { id: 'review', label: 'Hàng đợi duyệt', icon: CheckSquare },
        { id: 'release', label: 'Blocklist URL', icon: Rocket },
        { id: 'import', label: 'Nhập Batch', icon: Upload },
      ]
    },
    {
      group: 'TÌNH BÁO & KIỂM TOÁN',
      items: [
        { id: 'sources', label: 'Nguồn Threat Feeds', icon: Rss },
        { id: 'logs', label: 'Nhật ký Audit Logs', icon: History },
        ...(userRole === 'Admin'
          ? [
              { id: 'dns-nodes', label: 'Quản lý DNS Node', icon: Server },
              { id: 'login-logs', label: 'Nhật ký đăng nhập', icon: ShieldCheck },
              { id: 'users', label: 'Người dùng & Phân quyền', icon: Users },
            ]
          : []),
      ]
    }
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
          {navItems.map((sec, secIdx) => (
            <div key={secIdx}>
              {!isCollapsed && (
                <div className="px-3 mb-1.5 mt-6 first:mt-0 text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-[.06em] uppercase">
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

          {/* Quick Actions / Controls */}
          <div className="mt-6">
            {!isCollapsed && (
              <div className="px-3 mb-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                Công cụ điều khiển
              </div>
            )}
            <div className="space-y-1">
              {/* Search */}
              <button
                onClick={onOpenSearch}
                title={isCollapsed ? "Tìm kiếm..." : undefined}
                className={`
                  w-full flex items-center rounded-xl transition-all cursor-pointer group relative text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80
                  ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'}
                `}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Search className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                  {!isCollapsed && <span className="truncate text-xs">Tìm kiếm...</span>}
                </div>
                {!isCollapsed && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 font-mono">
                    Ctrl K
                  </span>
                )}
              </button>

              {/* Add Domain */}
              <button
                onClick={onOpenAddDomain}
                title={isCollapsed ? "Thêm tên miền mới" : undefined}
                className={`
                  w-full flex items-center rounded-xl transition-all cursor-pointer group relative text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40
                  ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'}
                `}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Plus className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-500" />
                  {!isCollapsed && <span className="truncate text-xs">Thêm tên miền</span>}
                </div>
              </button>

              {/* Shortcuts */}
              {onOpenShortcuts && (
                <button
                  onClick={onOpenShortcuts}
                  title={isCollapsed ? "Phím tắt" : undefined}
                  className={`
                    w-full flex items-center rounded-xl transition-all cursor-pointer group relative text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80
                    ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'}
                  `}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Keyboard className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
                    {!isCollapsed && <span className="truncate text-xs">Phím tắt</span>}
                  </div>
                </button>
              )}
            </div>
          </div>
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
