import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, TrendingUp, ShoppingBag, ShieldAlert,
  Sparkles, BarChart3, FileText, Globe, Play,
  Settings, CreditCard, LogOut, Bell, ChevronDown,
} from 'lucide-react';

const menuGroups = [
  {
    label: '광고 관리',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: '대시보드', color: '#94A3B8', end: true },
      { to: '/dashboard/autobid', icon: TrendingUp, label: '자동입찰(파워)', color: '#16A34A' },
      { to: '/dashboard/shopping', icon: ShoppingBag, label: '자동입찰(쇼핑)', color: '#2563EB' },
      { to: '/dashboard/click-fraud', icon: ShieldAlert, label: '부정클릭 방지', color: '#D97706' },
    ],
  },
  {
    label: '분석',
    items: [
      { to: '/dashboard/analytics', icon: Sparkles, label: 'AI 분석', color: '#7C3AED' },
      { to: '/dashboard/stats', icon: BarChart3, label: '통합 실적', color: '#0891B2' },
      { to: '/dashboard/report', icon: FileText, label: '성과 보고', color: '#0891B2' },
    ],
  },
  {
    label: '멀티 매체',
    badge: 'Pro',
    items: [
      { to: '/dashboard/meta', icon: Globe, label: 'Meta 광고', color: '#1877F2' },
      { to: '/dashboard/youtube', icon: Play, label: 'YouTube 광고', color: '#FF0000' },
    ],
  },
];

const bottomItems = [
  { to: '/dashboard/settings', icon: Settings, label: '설정' },
  { to: '/dashboard/billing', icon: CreditCard, label: '결제/플랜' },
];

const pageTitles: Record<string, string> = {
  '/dashboard': '대시보드',
  '/dashboard/autobid': '자동입찰 (파워링크)',
  '/dashboard/shopping': '자동입찰 (쇼핑검색)',
  '/dashboard/click-fraud': '부정클릭 방지',
  '/dashboard/analytics': 'AI 분석',
  '/dashboard/stats': '통합 실적',
  '/dashboard/report': '성과 보고',
  '/dashboard/meta': 'Meta 광고',
  '/dashboard/youtube': 'YouTube 광고',
  '/dashboard/settings': '설정',
  '/dashboard/billing': '결제/플랜',
};

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || '대시보드';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-all ${
      isActive
        ? 'bg-[#1E293B] text-[#F8FAFC] border-l-2 border-white -ml-[2px] pl-[14px]'
        : 'text-[#64748B] hover:bg-[#1E293B] hover:text-[#94A3B8]'
    }`;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-[220px] bg-[#0F172A] flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-5">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="A" className="w-8 h-8 rounded-lg" />
            <span className="text-white font-semibold text-lg tracking-tight">AdConcent</span>
          </div>
        </div>

        {/* User */}
        <div className="px-4 pb-4 border-b border-[#1E293B]">
          <p className="text-[#F8FAFC] text-sm font-medium truncate">{user?.email?.split('@')[0]}</p>
          <p className="text-[#475569] text-xs truncate">{user?.email}</p>
        </div>

        {/* Menu groups */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {menuGroups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 px-3 mb-2">
                <span className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider">{group.label}</span>
                {group.badge && (
                  <span className="text-[9px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded-full">{group.badge}</span>
                )}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={'end' in item ? (item as { end: boolean }).end : undefined} className={linkClass}>
                    <item.icon className="w-4 h-4 shrink-0" style={{ color: item.color }} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-[#1E293B] space-y-0.5">
          {bottomItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon className="w-4 h-4 shrink-0 text-[#64748B]" />
              <span>{label}</span>
              {label === '결제/플랜' && (
                <span className="ml-auto text-[9px] font-bold bg-[#1E293B] text-[#64748B] px-1.5 py-0.5 rounded">Free</span>
              )}
            </NavLink>
          ))}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-[#64748B] hover:bg-[#1E293B] hover:text-red-400 transition-all w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <h2 className="text-[15px] font-semibold text-gray-900">{pageTitle}</h2>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              <span>hitbunyang</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
