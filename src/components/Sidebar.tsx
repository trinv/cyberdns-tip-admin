import React from 'react';
import {
  LayoutDashboard, Globe, CheckSquare, Rocket, Upload,
  Rss, History, X,
  ShieldCheck, ChevronLeft, ChevronRight,
  Plus, Search, Keyboard, Users, UserCircle2
} from 'lucide-react';
import { CyberDNSLogo } from './CyberDNSLogo';
import { AppUser } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  reviewCount: number;
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

// Bootstrap `text-bg-*` badge variant per nav-item badge color — same
// semantic mapping the Tailwind version used (green="Live" status, amber="review
// queue" attention color, slate="neutral count").
function badgeVariantClass(color: string | undefined, isActive: boolean): string {
  if (isActive) return 'badge rounded-pill bg-primary-subtle text-primary';
  switch (color) {
    case 'emerald':
      return 'badge rounded-pill text-bg-success';
    case 'amber':
      return 'badge rounded-pill text-bg-warning';
    case 'rose':
      return 'badge rounded-pill text-bg-danger';
    default:
      return 'badge rounded-pill text-bg-secondary';
  }
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  reviewCount,
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
      group: 'QUY TRÌNH & KIỂM DUYỆT',
      items: [
        { id: 'review', label: 'Hàng đợi duyệt', icon: CheckSquare, badge: reviewCount > 0 ? `${reviewCount}` : undefined, badgeColor: 'amber' },
        { id: 'release', label: 'Blocklist URL', icon: Rocket, badge: undefined, badgeColor: 'rose' },
        { id: 'import', label: 'Nhập Batch', icon: Upload, badge: undefined, badgeColor: 'slate' },
      ]
    },
    {
      group: 'AUDIT & ACCOUNTS',
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
          className="d-md-none position-fixed top-0 start-0 end-0 bottom-0 bg-dark bg-opacity-75"
          style={{ zIndex: 1039 }}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`app-sidebar d-flex flex-column h-100 flex-shrink-0 ${isMobileOpen ? 'is-mobile-open' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}
      >
        {/* Brand Header with CyberDNS Logo */}
        <div className={`app-sidebar-brand d-flex align-items-center px-3 ${isCollapsed ? 'justify-content-center' : 'justify-content-between'}`}>
          <div
            onClick={() => handleNavClick('dashboard')}
            className="d-flex align-items-center gap-2 cursor-pointer"
            style={{ cursor: 'pointer' }}
            title="CyberDNS Category Manager"
          >
            <CyberDNSLogo size={32} showText={!isCollapsed} glow={isDarkMode} />
          </div>

          {/* Close button for Mobile Drawer */}
          <button
            onClick={onCloseMobile}
            className="app-header-icon-btn d-md-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Profile Card — real signed-in account, or a neutral "signed
            out" state (this app has no Google/photo avatar anymore — see
            src/middleware/auth.ts, self-hosted email/password only). */}
        <div className={`p-2 border-bottom ${isCollapsed ? 'd-flex justify-content-center' : ''}`}>
          {isCollapsed ? (
            <div className="position-relative d-inline-block" title={currentUser ? `${currentUser.email} — ${userRole}` : 'Chưa đăng nhập'}>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white"
                style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--bs-primary), var(--bs-info))' }}
              >
                <UserCircle2 size={26} />
              </div>
              {currentUser && (
                <span
                  className="position-absolute bottom-0 end-0 rounded-circle bg-success border border-2 border-body"
                  style={{ width: 12, height: 12 }}
                />
              )}
            </div>
          ) : (
            <div className="bg-body-tertiary rounded-3 p-2 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 min-w-0">
                <div className="position-relative flex-shrink-0">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white"
                    style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--bs-primary), var(--bs-info))' }}
                  >
                    <UserCircle2 size={20} />
                  </div>
                  {currentUser && (
                    <span
                      className="position-absolute bottom-0 end-0 rounded-circle bg-success border border-2 border-body"
                      style={{ width: 10, height: 10 }}
                    />
                  )}
                </div>
                <div className="text-truncate">
                  <div className="fw-bold small text-truncate">
                    {currentUser ? currentUser.displayName || currentUser.email : 'Chưa đăng nhập'}
                  </div>
                  <div className="text-body-secondary text-truncate d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                    <span className={`rounded-circle ${currentUser ? 'bg-success' : 'bg-secondary'}`} style={{ width: 6, height: 6, display: 'inline-block' }} />
                    <span>{currentUser ? userRole : 'Chỉ xem'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <div className="flex-grow-1 overflow-y-auto py-3 px-2" style={{ fontSize: '0.8125rem' }}>
          {navItems.map((sec, secIdx) => (
            <div key={secIdx}>
              {!isCollapsed && <div className="app-nav-group-label">{sec.group}</div>}
              <div className="d-flex flex-column gap-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={`app-nav-link ${isActive ? 'is-active' : ''} ${isCollapsed ? 'justify-content-center' : 'justify-content-between'}`}
                    >
                      <span className="d-flex align-items-center gap-2 min-w-0">
                        <Icon size={18} />
                        {!isCollapsed && <span className="text-truncate">{item.label}</span>}
                      </span>

                      {!isCollapsed && item.badge && (
                        <span className={badgeVariantClass(item.badgeColor, isActive)}>{item.badge}</span>
                      )}

                      {/* Small badge dot if collapsed */}
                      {isCollapsed && item.badge && (
                        <span
                          className={`position-absolute top-0 end-0 rounded-circle border border-2 border-body ${
                            item.badgeColor === 'amber' ? 'bg-warning' :
                            item.badgeColor === 'rose' ? 'bg-danger' :
                            item.badgeColor === 'emerald' ? 'bg-success' : 'bg-secondary'
                          }`}
                          style={{ width: 8, height: 8 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Actions / Controls */}
          <div className="mt-4">
            {!isCollapsed && <div className="app-nav-group-label">Công cụ điều khiển</div>}
            <div className="d-flex flex-column gap-1">
              {/* Search */}
              <button
                onClick={onOpenSearch}
                title={isCollapsed ? 'Tìm kiếm...' : undefined}
                className={`app-nav-link ${isCollapsed ? 'justify-content-center' : 'justify-content-between'}`}
              >
                <span className="d-flex align-items-center gap-2 min-w-0">
                  <Search size={16} />
                  {!isCollapsed && <span className="text-truncate">Tìm kiếm...</span>}
                </span>
                {!isCollapsed && <kbd className="small">Ctrl K</kbd>}
              </button>

              {/* Add Domain */}
              <button
                onClick={onOpenAddDomain}
                title={isCollapsed ? 'Thêm tên miền mới' : undefined}
                className={`app-nav-link ${isCollapsed ? 'justify-content-center' : 'justify-content-between'}`}
              >
                <span className="d-flex align-items-center gap-2 min-w-0">
                  <Plus size={16} />
                  {!isCollapsed && <span className="text-truncate">Thêm tên miền</span>}
                </span>
              </button>

              {/* Shortcuts */}
              {onOpenShortcuts && (
                <button
                  onClick={onOpenShortcuts}
                  title={isCollapsed ? 'Phím tắt' : undefined}
                  className={`app-nav-link ${isCollapsed ? 'justify-content-center' : 'justify-content-between'}`}
                >
                  <span className="d-flex align-items-center gap-2 min-w-0">
                    <Keyboard size={16} />
                    {!isCollapsed && <span className="text-truncate">Phím tắt</span>}
                  </span>
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
        <div className="p-2 border-top">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              className="btn btn-outline-secondary btn-sm w-100 d-none d-md-flex align-items-center justify-content-center"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
