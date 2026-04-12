import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard, Shield, TrendingUp, BarChart3,
  FileText, Settings, CreditCard, LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드', end: true },
  { to: '/dashboard/click-fraud', icon: Shield, label: '부정클릭 차단' },
  { to: '/dashboard/autobid', icon: TrendingUp, label: '자동 입찰' },
  { to: '/dashboard/analytics', icon: BarChart3, label: '분석' },
  { to: '/dashboard/report', icon: FileText, label: '리포트' },
  { to: '/dashboard/settings', icon: Settings, label: '설정' },
  { to: '/dashboard/billing', icon: CreditCard, label: '결제' },
];

export function DashboardLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600">AdConcent</h1>
          <p className="text-xs text-gray-500 mt-1">광고 보호 & 최적화</p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 truncate mb-2">{user?.email}</p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
