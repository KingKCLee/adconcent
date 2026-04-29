import { useEffect, useState } from 'react';
import { workerFetch } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Daily { day: string; clicks: number; suspicious: number }

export default function GoogleDashboard() {
  const [daily, setDaily] = useState<Daily[]>([]);

  useEffect(() => {
    workerFetch<{ daily: Daily[] }>('/api/admin/dashboard/roas')
      .then((r) => setDaily(r.daily || []))
      .catch(() => {});
  }, []);

  const total = daily.reduce((a, d) => a + d.clicks, 0);
  const sus = daily.reduce((a, d) => a + d.suspicious, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
        <h1 className="text-xl font-bold text-gray-900">구글 대시보드</h1>
      </div>
      <p className="text-sm text-gray-500">
        Google Ads · TrueView + DemandGen + Search · campaignMetricsSync 매시 정각.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="30d 클릭" value={total.toLocaleString()} color="#4285F4" />
        <Card label="30d 의심" value={sus.toLocaleString()} color="#EA4335" />
        <Card label="고객 ID" value="1581690943" color="#34A853" mono />
        <Card label="cron 동기화" value="매시 정각" color="#FBBC04" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-bold text-sm mb-3">30일 클릭 추이</h2>
        <div style={{ width: '100%', height: 240 }}>
          {daily.length === 0 ? (
            <div className="text-center text-gray-400 pt-20 text-sm">데이터 로드 중...</div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={[...daily].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="clicks" stroke="#4285F4" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="suspicious" stroke="#EA4335" strokeWidth={1} dot={{ r: 1 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, color, mono }: { label: string; value: string; color: string; mono?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs mb-2" style={{ color }}>{label}</div>
      <div className={`text-lg font-bold text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
