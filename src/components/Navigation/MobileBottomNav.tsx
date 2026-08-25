import React from 'react';
import { 
  LayoutDashboard, Globe, CheckSquare, Rocket, Menu, 
  Sparkles, ShieldAlert 
} from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  reviewCount: number;
  unreleasedCount: number;
  onOpenMobileMenu: () => void;
  onOpenAddDomain: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  reviewCount,
  unreleasedCount,
  onOpenMobileMenu,
  onOpenAddDomain,
}) => {
  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'domain',
      label: 'Tên miền',
      icon: Globe,
    },
    {
      id: 'review',
      label: 'Duyệt',
      icon: CheckSquare,
      badge: reviewCount,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'release',
      label: 'Phát hành',
      icon: Rocket,
      badge: unreleasedCount > 0 ? unreleasedCount : undefined,
      badgeColor: 'bg-rose-500',
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer active-press ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                
                {/* Notification Badge */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-xs font-bold text-white flex items-center justify-center ${tab.badgeColor || 'bg-blue-600'} animate-pulse`}>
                    {tab.badge}
                  </span>
                )}
              </div>

              <span className="text-xs mt-1 tracking-tight leading-none">
                {tab.label}
              </span>

              {/* Active Indicator Dot */}
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-0.5"></span>
              )}
            </button>
          );
        })}

        {/* Menu / Drawer Button */}
        <button
          onClick={onOpenMobileMenu}
          className="relative flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer active-press"
        >
          <div className="relative">
            <Menu className="w-5 h-5 stroke-[1.8]" />
          </div>
          <span className="text-xs mt-1 tracking-tight leading-none">
            Menu
          </span>
        </button>
      </div>
    </div>
  );
};
