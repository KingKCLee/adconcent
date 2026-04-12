import { Shield, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';

const stats = [
  { label: '오늘 클릭', value: '-', icon: BarChart3, color: 'text-blue-600' },
  { label: '차단된 IP', value: '-', icon: Shield, color: 'text-red-600' },
  { label: '의심 클릭', value: '-', icon: AlertTriangle, color: 'text-amber-600' },
  { label: '절감 비용', value: '-', icon: TrendingUp, color: 'text-green-600' },
];

export function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{label}</span>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <p className="text-gray-500 text-center">사이트를 연결하면 실시간 데이터가 표시됩니다.</p>
      </div>
    </div>
  );
}
