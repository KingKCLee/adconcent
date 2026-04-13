import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SiteProvider, useSite } from '@/contexts/SiteContext';
import {
  LayoutDashboard, TrendingUp, ShoppingBag, ShieldAlert,
  Sparkles, BarChart3, FileText, Globe, Play,
  Settings, CreditCard, LogOut, Bell, ChevronDown, Check,
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

const PLAN_BADGE_COLOR: Record<string, string> = {
  free: 'bg-[#1E293B] text-[#94A3B8]',
  starter: 'bg-emerald-600 text-white',
  growth: 'bg-blue-600 text-white',
  pro: 'bg-violet-600 text-white',
};

export function DashboardLayout() {
  return (
    <SiteProvider>
      <DashboardLayoutInner />
    </SiteProvider>
  );
}

function DashboardLayoutInner() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || '대시보드';
  const { sites, siteId, siteDomain, plan, setSiteId, isLoading: siteLoading } = useSite();
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSiteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${PLAN_BADGE_COLOR[plan] ?? PLAN_BADGE_COLOR.free}`}>
                  {planLabel}
                </span>
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
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setSiteDropdownOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 min-w-[140px]"
              >
                <span className="truncate max-w-[120px]">
                  {siteLoading ? '불러오는 중...' : siteDomain || siteId || '사이트 없음'}
                </span>
                <ChevronDown className="w-3 h-3 ml-auto" />
              </button>
              {siteDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                  {sites.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">등록된 사이트가 없습니다</div>
                  ) : (
                    sites.map((s) => (
                      <button
                        key={s.site_id}
                        onClick={() => {
                          setSiteId(s.site_id);
                          setSiteDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-gray-900 font-medium truncate">{s.domain}</p>
                          <p className="text-[10px] text-gray-400 truncate">{s.site_id}</p>
                        </div>
                        {s.site_id === siteId && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    ))
                  )}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <NavLink
                      to="/dashboard/settings"
                      onClick={() => setSiteDropdownOpen(false)}
                      className="block px-3 py-2 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      + 사이트 추가
                    </NavLink>
                  </div>
                </div>
              )}
            </div>
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
