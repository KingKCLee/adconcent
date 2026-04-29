import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SiteProvider, useSite } from '@/contexts/SiteContext';
import {
  LayoutDashboard, Megaphone, Phone, Globe,
  TrendingUp, Hash, ShieldAlert, BarChart3, Settings,
  ShieldCheck, Sparkles, CreditCard, LogOut, Bell, ChevronDown, Check,
} from 'lucide-react';

const NAVER_GREEN = '#03C75A';
const GOOGLE_BLUE = '#4285F4';

const menuGroups = [
  {
    label: '통합 관리',
    items: [
      { to: '/workspace', icon: LayoutDashboard, label: '홈', color: '#94A3B8', end: true },
      { to: '/workspace/campaigns', icon: Megaphone, label: '캠페인', color: '#6366F1' },
      { to: '/workspace/leads', icon: Phone, label: '리드', color: '#F59E0B' },
      { to: '/workspace/sites', icon: Globe, label: '사이트', color: '#0EA5E9' },
    ],
  },
  {
    label: '네이버 광고',
    color: NAVER_GREEN,
    items: [
      { to: '/workspace/naver', icon: LayoutDashboard, label: '네이버 대시보드', color: NAVER_GREEN, end: true },
      { to: '/workspace/naver/autobid', icon: TrendingUp, label: '자동입찰', color: NAVER_GREEN },
      { to: '/workspace/naver/keywords', icon: Hash, label: '키워드', color: NAVER_GREEN },
      { to: '/workspace/naver/click-fraud', icon: ShieldAlert, label: '부정클릭', color: NAVER_GREEN },
      { to: '/workspace/naver/stats', icon: BarChart3, label: '통계', color: NAVER_GREEN },
      { to: '/workspace/naver/settings', icon: Settings, label: '설정', color: NAVER_GREEN },
    ],
  },
  {
    label: '구글 광고',
    color: GOOGLE_BLUE,
    items: [
      { to: '/workspace/google', icon: LayoutDashboard, label: '구글 대시보드', color: GOOGLE_BLUE, end: true },
      { to: '/workspace/google/campaigns', icon: Megaphone, label: '캠페인 관리', color: GOOGLE_BLUE },
      { to: '/workspace/google/audit', icon: ShieldCheck, label: '봇/Placement', color: GOOGLE_BLUE },
      { to: '/workspace/google/stats', icon: BarChart3, label: '통계', color: GOOGLE_BLUE },
      { to: '/workspace/google/settings', icon: Settings, label: '설정', color: GOOGLE_BLUE },
    ],
  },
  {
    label: 'AI · 결제',
    items: [
      { to: '/workspace/ai', icon: Sparkles, label: 'AI 분석', color: '#7C3AED' },
      { to: '/workspace/billing', icon: CreditCard, label: '결제', color: '#DB2777' },
    ],
  },
];

const pageTitles: Record<string, string> = {
  '/workspace': '홈',
  '/workspace/campaigns': '캠페인',
  '/workspace/leads': '리드',
  '/workspace/sites': '사이트',
  '/workspace/naver': '네이버 대시보드',
  '/workspace/naver/autobid': '네이버 자동입찰',
  '/workspace/naver/keywords': '네이버 키워드',
  '/workspace/naver/click-fraud': '네이버 부정클릭',
  '/workspace/naver/stats': '네이버 통계',
  '/workspace/naver/settings': '네이버 설정',
  '/workspace/google': '구글 대시보드',
  '/workspace/google/campaigns': '구글 캠페인 관리',
  '/workspace/google/audit': '구글 봇/Placement',
  '/workspace/google/stats': '구글 통계',
  '/workspace/google/settings': '구글 설정',
  '/workspace/ai': 'AI 분석',
  '/workspace/billing': '결제',
};

const PLAN_BADGE_COLOR: Record<string, string> = {
  free: 'bg-[#1E293B] text-[#94A3B8]',
  starter: 'bg-emerald-600 text-white',
  growth: 'bg-blue-600 text-white',
  pro: 'bg-violet-600 text-white',
};

export function AdminLayout() {
  return (
    <SiteProvider>
      <AdminLayoutInner />
    </SiteProvider>
  );
}

function AdminLayoutInner() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || '관리자';
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
      <aside className="w-[220px] bg-[#0F172A] flex flex-col shrink-0">
        <div className="px-4 py-5">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="A" className="w-8 h-8 rounded-lg" />
            <span className="text-white font-semibold text-lg tracking-tight">AdConcent</span>
            <span className="text-[9px] font-bold bg-violet-600/80 text-white px-1.5 py-0.5 rounded-full ml-auto">
              ADMIN
            </span>
          </div>
        </div>

        <div className="px-4 pb-4 border-b border-[#1E293B]">
          <p className="text-[#F8FAFC] text-sm font-medium truncate">{user?.email?.split('@')[0]}</p>
          <p className="text-[#475569] text-xs truncate">{user?.email}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {menuGroups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-2 px-3 mb-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: group.color || '#475569' }}
                >
                  {group.label}
                </span>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={'end' in item ? (item as { end: boolean }).end : undefined}
                    className={linkClass}
                  >
                    <item.icon className="w-4 h-4 shrink-0" style={{ color: item.color }} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-[#1E293B] space-y-0.5">
          <NavLink to="/workspace/billing" className={linkClass}>
            <CreditCard className="w-4 h-4 shrink-0 text-[#64748B]" />
            <span>결제/플랜</span>
            <span
              className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${PLAN_BADGE_COLOR[plan] ?? PLAN_BADGE_COLOR.free}`}
            >
              {planLabel}
            </span>
          </NavLink>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-[#64748B] hover:bg-[#1E293B] hover:text-red-400 transition-all w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col bg-[#F8FAFC] min-w-0">
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
                </div>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
