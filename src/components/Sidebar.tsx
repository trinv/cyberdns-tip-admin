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
  reviewCount: number;
  unreleasedCount: number;
  totalDomainCount?: number;
  sourcesCount?: number;
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
  reviewCount,
  unreleasedCount,
  totalDomainCount = 0,
  sourcesCount = 0,
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
        { id: 'dashboard', label: 'SOC Dashboard', icon: LayoutDashboard, badge: 'Live', badgeColor: 'emerald' },
        {
          id: 'domain',
          label: 'Domain Explorer',
          icon: Globe,
          badge: totalDomainCount > 0 ? totalDomainCount.toLocaleString('vi-VN') : undefined,
          badgeColor: 'slate' as const,
        },
      ]
    },
    {
      group: 'QUY TRÌNH & DUYỆT',
      items: [
        { id: 'review', label: 'Hàng đợi duyệt', icon: CheckSquare, badge: reviewCount > 0 ? `${reviewCount}` : undefined, badgeColor: 'amber' },
        { id: 'release', label: 'Bản phát hành', icon: Rocket, badge: unreleasedCount > 0 ? `${unreleasedCount}` : undefined, badgeColor: 'rose' },
        { id: 'import', label: 'Nhập Batch', icon: Upload, badge: undefined, badgeColor: 'slate' },
      ]
    },
    {
      group: 'TÌNH BÁO & KIỂM TOÁN',
      items: [
        {
          id: 'sources',
          label: 'Nguồn Threat Feeds',
          icon: Rss,
          badge: sourcesCount > 0 ? `${sourcesCount}` : undefined,
          badgeColor: 'blue' as const,
        },
        { id: 'logs', label: 'Nhật ký Audit Logs', icon: History, badge: undefined, badgeColor: 'slate' },
        ...(userRole === 'Admin'
          ? [
              { id: 'login-logs', label: 'Nhật ký đăng nhập', icon: ShieldCheck, badge: undefined, badgeColor: 'slate' as const },
              { id: 'users', label: 'Người dùng & Phân quyền', icon: Users, badge: undefined, badgeColor: 'slate' as const },
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
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
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
              {currentUser && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></span>}
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-2.5 flex items-center justify-between transition-colors">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm overflow-hidden ring-2 ring-emerald-500/20">
                    <UserCircle2 className="w-5 h-5" />
                  </div>
                  {currentUser && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800"></span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {currentUser ? currentUser.displayName || currentUser.email : 'Chưa đăng nhập'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate flex items-center space-x-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
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
                <div className="px-3 mb-1.5 text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
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
                        w-full flex items-center rounded-xl transition-all cursor-pointer group relative
                        ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'}
                        ${
                          isActive
                            ? 'bg-emerald-600 dark:bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-500/20'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                        {!isCollapsed && (
                          <span className="truncate text-xs">{item.label}</span>
                        )}
                      </div>

                      {!isCollapsed && item.badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-md font-mono font-bold flex-shrink-0 ${
                          isActive 
                            ? 'bg-white/20 text-white' 
                            : item.badgeColor === 'emerald'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                            : item.badgeColor === 'amber'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 animate-pulse'
                            : item.badgeColor === 'rose'
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {item.badge}
                        </span>
                      )}

                      {/* Small badge dot if collapsed */}
                      {isCollapsed && item.badge && (
                        <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                          item.badgeColor === 'amber' ? 'bg-amber-500' :
                          item.badgeColor === 'rose' ? 'bg-rose-500' :
                          item.badgeColor === 'emerald' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`} />
                      )}
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

        {/* Footer Area: Edge Status Card & Collapse Toggle */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          {!isCollapsed && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white rounded-2xl p-3.5 space-y-2 border border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-bold text-xs">DNS Edge Anycast</div>
                    <div className="text-xs text-slate-400">16 PoPs Quốc tế & VN</div>
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <button 
                onClick={() => handleNavClick('release')}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1 transition-colors shadow-xs cursor-pointer active-press"
              >
                <span>Cập nhật Edge RPZ</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
