import { useState, useEffect } from 'react';
import { Shield, Ban, TrendingDown } from 'lucide-react';
import { workerFetch } from '@/lib/api';

interface StatsResponse {
  ips: { ip: string; count: number; firstSeen: string; lastSeen: string; events: { event: string; time: string }[] }[];
  summary: { total: number; totalClicks: number };
}

export function ClickFraudPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workerFetch<StatsResponse>('/stats?site_id=hitbunyang')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalClicks = stats?.summary.totalClicks || 0;
  const suspiciousIps = stats?.ips.filter(ip => ip.count >= 5) || [];
  const blockedCount = suspiciousIps.length;

  const kpis = [
    { label: '지난 48시간 클릭', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50', value: `${totalClicks}건` },
    { label: '자동 차단 IP', icon: Ban, color: 'text-red-600', bg: 'bg-red-50', value: `${blockedCount}개` },
    { label: '추정 절감액', icon: TrendingDown, color: 'text-green-600', bg: 'bg-green-50', value: `₩${(blockedCount * 500).toLocaleString()}` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(({ label, icon: Icon, color, bg, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* IP Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">IP별 클릭 현황</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : (stats?.ips.length || 0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">IP</th>
                  <th className="px-5 py-3 font-medium">클릭 수</th>
                  <th className="px-5 py-3 font-medium">첫 접속</th>
                  <th className="px-5 py-3 font-medium">마지막 접속</th>
                  <th className="px-5 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {stats!.ips
                  .sort((a, b) => b.count - a.count)
                  .map((row) => (
                    <tr key={row.ip} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-gray-700">{row.ip}</td>
                      <td className="px-5 py-3 text-gray-700 font-medium">{row.count}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{new Date(row.firstSeen).toLocaleString('ko-KR')}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{new Date(row.lastSeen).toLocaleString('ko-KR')}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          row.count >= 10 ? 'bg-red-50 text-red-600' :
                          row.count >= 5 ? 'bg-amber-50 text-amber-600' :
                          'bg-green-50 text-green-600'
                        }`}>
                          {row.count >= 10 ? '차단됨' : row.count >= 5 ? '의심' : '정상'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">수집된 클릭 데이터가 없습니다</div>
        )}
      </div>
    </div>
  );
}
