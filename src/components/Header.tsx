import React from 'react';
import {
  Search, Bell, ChevronDown,
  Menu,
  CheckSquare, Rocket, Upload, Rss, History,
  Sun, Moon,
  LayoutDashboard, Globe, LogIn, LogOut, UserCircle2, Users
} from 'lucide-react';
import { AppUser } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

export interface HeaderNotification {
  id: string;
  title: string;
  description: string;
  tab: string;
  timestamp?: string;
}

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenSearch: () => void;
  reviewCount: number;
  notifications: HeaderNotification[];
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
  notifications,
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
  const notificationsRef = React.useRef<HTMLDivElement>(null);
  const roleDropdownRef = React.useRef<HTMLDivElement>(null);
  useClickOutside(notificationsRef, () => setNotificationsOpen(false), notificationsOpen);
  useClickOutside(roleDropdownRef, () => setRoleDropdownOpen(false), roleDropdownOpen);

  const getTabInfo = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return { title: 'SOC Threat Dashboard', icon: LayoutDashboard, category: 'Tổng quan' };
      case 'domain':
        return { title: 'Quản trị Danh mục Tên miền (Domain Explorer)', icon: Globe, category: 'Khám phá' };
      case 'review':
        return { title: 'Hàng đợi Phê duyệt Tên miền (Review Queue)', icon: CheckSquare, category: 'Kiểm duyệt' };
      case 'release':
        return { title: 'Blocklist URL Đã Phát Hành', icon: Rocket, category: 'Phát hành' };
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
    <header className="app-header sticky-top d-flex align-items-center">
      <div className="w-100 h-100 px-3 px-sm-4 d-flex align-items-center justify-content-between gap-2 gap-sm-3">
        {/* Left Section: Sidebar toggle + Breadcrumbs & View Title */}
        <div className="d-flex align-items-center gap-2 gap-sm-3 flex-grow-1 min-w-0">
          {/* Hamburger / Sidebar Toggle */}
          <button
            onClick={onToggleSidebar}
            id="btn-toggle-sidebar"
            className="app-header-icon-btn rounded-2 bg-body-tertiary flex-shrink-0"
            title="Mở / Đóng thanh điều hướng"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb Title */}
          <div className="d-none d-sm-flex align-items-center gap-2 min-w-0">
            <div className="d-flex align-items-center gap-1 text-body-secondary small fw-medium">
              <span>CyberDNS</span>
              <span>/</span>
              <span className="fw-semibold">{activeTabInfo.category}</span>
              <span>/</span>
            </div>
            <div className="d-flex align-items-center gap-1 small fw-bold text-truncate">
              <TabIcon size={14} className="text-primary flex-shrink-0" />
              <span className="text-truncate">{activeTabInfo.title}</span>
            </div>
          </div>

          {/* Mobile Title */}
          <div className="d-sm-none d-flex align-items-center gap-1 small fw-bold text-truncate">
            <TabIcon size={16} className="text-primary flex-shrink-0" />
            <span className="text-truncate">{activeTabInfo.title.split('(')[0]}</span>
          </div>

          {/* Quick Search Box */}
          <div onClick={onOpenSearch} className="d-none d-md-flex position-relative ms-2" style={{ maxWidth: 260, width: '100%', cursor: 'pointer' }}>
            <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-body-secondary" style={{ pointerEvents: 'none' }} />
            <input
              type="text"
              readOnly
              placeholder="Tìm domain, IP, ASN..."
              className="form-control form-control-sm rounded-3"
              style={{ paddingLeft: '2rem', paddingRight: '2.5rem', cursor: 'pointer' }}
            />
            <kbd className="position-absolute top-50 end-0 translate-middle-y me-2 small">⌘K</kbd>
          </div>
        </div>

        {/* Right Section: Theme, Notifications, User Profile */}
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          {/* Theme Toggle Button (Light / Dark) */}
          <button
            onClick={toggleTheme}
            id="btn-toggle-theme"
            title={isDarkMode ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            className="app-header-icon-btn"
          >
            {isDarkMode ? <Sun size={16} className="text-warning" /> : <Moon size={16} />}
          </button>

          {/* Notification Bell */}
          <div className="position-relative" ref={notificationsRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="app-header-icon-btn position-relative"
              title="Thông báo"
            >
              <Bell size={16} />
              {notifications.length > 0 && (
                <span
                  className="position-absolute badge rounded-pill bg-danger"
                  style={{ top: 2, right: 2, fontSize: '0.625rem', minWidth: 16, padding: '0.15rem 0.35rem' }}
                >
                  {notifications.length}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="dropdown-menu show shadow-lg p-0 mt-2" style={{ width: 320, right: 0, left: 'auto' }}>
                <div className="px-3 pb-2 pt-2 border-bottom d-flex align-items-center justify-content-between">
                  <span className="fw-bold small">Thông báo SOC</span>
                  {notifications.length > 0 && (
                    <span className="badge rounded-pill text-bg-success-subtle text-success">{notifications.length} Mới</span>
                  )}
                </div>
                <div className="py-1" style={{ maxHeight: 288, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div className="px-3 py-4 text-center text-body-secondary small">Không có thông báo mới.</div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => { setCurrentTab(n.tab); setNotificationsOpen(false); }}
                        className="px-3 py-2 border-bottom small"
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="fw-semibold">{n.title}</div>
                        <div className="text-body-secondary mt-1">{n.description}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="vr d-none d-sm-block mx-1" style={{ height: 20 }} />

          {/* User Profile — self-hosted email/password session */}
          {!currentUser ? (
            <button
              onClick={onOpenLogin}
              disabled={isAuthLoading}
              className="btn btn-primary btn-sm rounded-pill d-flex align-items-center gap-1"
              title="Đăng nhập để thực hiện các thao tác ghi (thêm/sửa domain, phát hành, v.v.)"
            >
              <LogIn size={14} />
              <span>Đăng nhập</span>
            </button>
          ) : (
            <div className="position-relative" ref={roleDropdownRef}>
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="btn btn-light btn-sm rounded-pill d-flex align-items-center gap-2 border"
              >
                <div className="rounded-circle overflow-hidden bg-body-tertiary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 32, height: 32 }}>
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.displayName || 'User avatar'} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                  ) : (
                    <UserCircle2 size={22} className="text-body-secondary" />
                  )}
                </div>
                <div className="d-none d-sm-flex flex-column align-items-start lh-sm">
                  <span className="fw-bold small text-truncate" style={{ maxWidth: 120 }}>
                    {currentUser.displayName || currentUser.email}
                  </span>
                  <span className="text-primary fw-semibold" style={{ fontSize: '0.6875rem' }}>{userRole}</span>
                </div>
                <ChevronDown size={14} className="text-body-secondary" />
              </button>

              {roleDropdownOpen && (
                <div className="dropdown-menu show shadow-lg mt-2" style={{ width: 224, right: 0, left: 'auto' }}>
                  <div className="px-3 py-2 border-bottom mb-1">
                    <div className="fw-bold small text-truncate">{currentUser.displayName || 'Người dùng'}</div>
                    <div className="text-body-secondary font-monospace text-truncate" style={{ fontSize: '0.75rem' }}>{currentUser.email}</div>
                    <div className="text-primary fw-bold mt-1" style={{ fontSize: '0.75rem' }}>Vai trò: {userRole}</div>
                  </div>
                  {userRole === 'Admin' && (
                    <button
                      onClick={() => { setRoleDropdownOpen(false); setCurrentTab('users'); }}
                      className="dropdown-item d-flex align-items-center gap-2 small"
                    >
                      <Users size={14} />
                      <span>Quản lý người dùng</span>
                    </button>
                  )}
                  <button
                    onClick={() => { setRoleDropdownOpen(false); onSignOut(); }}
                    className="dropdown-item d-flex align-items-center gap-2 small text-danger border-top mt-1 pt-2"
                  >
                    <LogOut size={14} />
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
