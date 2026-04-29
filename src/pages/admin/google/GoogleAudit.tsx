import { useEffect, useState } from 'react';
import { workerFetch } from '@/lib/api';

interface FraudStats {
  total_24h: number;
  suspicious_24h: number;
  blocked_total: number;
  rate_pct: number;
}

interface FunnelRow {
  channel: string;
  clicks: number;
  uniques: number;
  google_paid: number;
  naver_paid: number;
}

export default function GoogleAudit() {
  const [fraud, setFraud] = useState<FraudStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);

  useEffect(() => {
    workerFetch<FraudStats>('/api/admin/dashboard/fraud').then(setFraud).catch(() => {});
    workerFetch<{ funnel: FunnelRow[] }>('/api/admin/dashboard/funnel').then((r) => setFunnel([])).catch(() => {});
    workerFetch<{ funnel: FunnelRow[] }>('/api/admin/analytics/funnel?site_id=hitbunyang')
      .then((r) => setFunnel(r.funnel || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
        <h1 className="text-xl font-bold text-gray-900">구글 봇 / Placement 감사</h1>
      </div>
      <p className="text-sm text-gray-500">
        autoExcludePlacements LIVE · lpRegressionCheck 매시 · asp.jeomsin.co.kr 자동 negative 이력.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="24h 클릭" value={fraud?.total_24h.toLocaleString()} color="#4285F4" />
        <Card label="24h 의심" value={fraud?.suspicious_24h.toLocaleString()} color="#EA4335" />
        <Card label="누적 차단" value={fraud?.blocked_total.toLocaleString()} color="#FBBC04" />
        <Card label="부정 비율" value={fraud ? `${fraud.rate_pct}%` : '—'} color="#34A853" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-bold text-sm mb-3">소스 별 트래픽 (7d)</h2>
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left">소스</th>
              <th className="px-2 py-1.5 text-right">클릭</th>
              <th className="px-2 py-1.5 text-right">유니크</th>
              <th className="px-2 py-1.5 text-right">Google paid</th>
              <th className="px-2 py-1.5 text-right">Naver paid</th>
            </tr>
          </thead>
          <tbody>
            {funnel.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">데이터 없음</td></tr>
            ) : funnel.map((f) => (
              <tr key={f.channel} className="border-t border-gray-100">
                <td className="px-2 py-1.5 font-medium">{f.channel}</td>
                <td className="px-2 py-1.5 text-right">{f.clicks?.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right">{f.uniques?.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right">{f.google_paid?.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right">{f.naver_paid?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value?: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs mb-2" style={{ color }}>{label}</div>
      <div className="text-lg font-bold text-gray-900">{value ?? '...'}</div>
    </div>
  );
}
