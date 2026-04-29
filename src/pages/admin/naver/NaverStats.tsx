import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { fetchNaverStats, type NaverStatsResult } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function NaverStats() {
  const { siteId } = useSite();
  const [stats, setStats] = useState<NaverStatsResult | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!siteId) return;
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    fetchNaverStats(siteId, { since, until }, { idType: 'campaign', timeUnit: 'day' })
      .then(setStats)
      .catch(() => {});
  }, [siteId, days]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#03C75A]" />
          <h1 className="text-xl font-bold text-gray-900">네이버 통계</h1>
        </div>
        <div className="flex gap-1">
          {[7, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs ${d === days ? 'bg-[#03C75A] text-white' : 'bg-gray-100 text-gray-600'}`}>
              {d}일
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-bold text-sm mb-3">캠페인 일별 노출/클릭</h2>
        <div style={{ width: '100%', height: 300 }}>
          {!stats?.daily?.length ? (
            <div className="text-center text-gray-400 pt-24 text-sm">데이터 없음</div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="impCnt" fill="#03C75A" name="노출" />
                <Bar dataKey="clkCnt" fill="#0F172A" name="클릭" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-bold text-sm mb-2">합산 KPI ({days}d)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <KV label="노출" v={stats?.totals?.impCnt} />
          <KV label="클릭" v={stats?.totals?.clkCnt} />
          <KV label="광고비" v={stats?.totals?.salesAmt} prefix="₩" />
          <KV label="CTR" v={stats?.totals?.crto} suffix="%" />
        </div>
      </div>
    </div>
  );
}

function KV({ label, v, prefix = '', suffix = '' }: { label: string; v?: number; prefix?: string; suffix?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-bold">{v == null ? '—' : `${prefix}${v.toLocaleString()}${suffix}`}</div>
    </div>
  );
}
