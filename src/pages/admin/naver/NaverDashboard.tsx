import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { fetchNaverStats, type NaverStatsResult } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function NaverDashboard() {
  const { siteId } = useSite();
  const [stats, setStats] = useState<NaverStatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    fetchNaverStats(siteId, { since, until }, { idType: 'campaign', timeUnit: 'day' })
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [siteId]);

  const totals = stats?.totals;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#03C75A]" />
        <h1 className="text-xl font-bold text-gray-900">네이버 대시보드</h1>
      </div>
      <p className="text-sm text-gray-500">7d 캠페인 KPI · bid_settings 112 키워드 LIVE 자동입찰 동작 중.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="노출" value={totals?.impCnt} />
        <Card label="클릭" value={totals?.clkCnt} />
        <Card label="광고비" value={totals?.salesAmt} prefix="₩" />
        <Card label="CTR" value={totals?.crto} suffix="%" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-bold text-sm text-gray-900 mb-3">7일 추이</h2>
        <div style={{ width: '100%', height: 240 }}>
          {loading ? (
            <div className="text-center text-gray-400 pt-20 text-sm">로드 중...</div>
          ) : !stats?.daily?.length ? (
            <div className="text-center text-gray-400 pt-20 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="clkCnt" stroke="#03C75A" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, prefix = '', suffix = '' }: { label: string; value?: number; prefix?: string; suffix?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="text-xl font-bold text-gray-900">
        {value == null ? '...' : `${prefix}${value.toLocaleString()}${suffix}`}
      </div>
    </div>
  );
}
