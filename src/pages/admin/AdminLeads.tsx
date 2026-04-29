import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { workerFetch } from '@/lib/api';

interface LogRow {
  id: number;
  click_at: number;
  ip: string;
  ua: string;
  landing_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  is_suspicious: number;
  device: string;
}

export default function AdminLeads() {
  const { siteId } = useSite();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    workerFetch<{ logs: LogRow[] }>(`/api/admin/analytics/click-logs?site_id=${siteId}&limit=50`)
      .then((r) => setRows(r.logs || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [siteId]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">리드 / 클릭 로그</h1>
      <p className="text-sm text-gray-500">최근 24h 50건 — is_suspicious=1 (의심)은 자동 차단 대상.</p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">시각</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">디바이스</th>
              <th className="px-3 py-2 text-left">소스</th>
              <th className="px-3 py-2 text-left">랜딩</th>
              <th className="px-3 py-2 text-center">의심</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">로드 중...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">데이터 없음</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-xs text-gray-500">{new Date(r.click_at * 1000).toLocaleString('ko-KR')}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.ip}</td>
                <td className="px-3 py-2 text-xs">{r.device}</td>
                <td className="px-3 py-2 text-xs">{r.utm_source || '—'}/{r.utm_medium || '—'}</td>
                <td className="px-3 py-2 text-xs text-blue-600 truncate max-w-[260px]">{r.landing_url}</td>
                <td className="px-3 py-2 text-center">
                  {r.is_suspicious ? (
                    <span className="inline-flex bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded">의심</span>
                  ) : (
                    <span className="text-gray-300 text-[10px]">정상</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
