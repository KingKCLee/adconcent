import { useEffect, useState } from 'react';
import { workerFetch } from '@/lib/api';

interface Campaign {
  id?: string;
  name?: string;
  status?: string;
  channel_type?: string;
}

export default function GoogleCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workerFetch<any>(`/api/google-ads/campaigns`)
      .then((r) => setCampaigns(r.campaigns || r.data || []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
        <h1 className="text-xl font-bold text-gray-900">구글 캠페인 관리</h1>
      </div>
      <p className="text-sm text-gray-500">
        시흥거모B1 + DemandGen LIVE · ad mutate · finalUrl 정정 검증 (2026-04-28).
      </p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">캠페인 ID</th>
              <th className="px-3 py-2 text-left">이름</th>
              <th className="px-3 py-2 text-center">유형</th>
              <th className="px-3 py-2 text-center">상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-12 text-center text-gray-400">로드 중...</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-12 text-center text-gray-400">캠페인 없음 — Worker /api/google-ads/campaigns 응답 확인</td></tr>
            ) : campaigns.map((c, i) => (
              <tr key={c.id || i} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono text-xs">{c.id || '—'}</td>
                <td className="px-3 py-2 font-medium">{c.name || '—'}</td>
                <td className="px-3 py-2 text-center text-xs">{c.channel_type || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={c.status === 'ENABLED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                    style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
                    {c.status || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-bold">광고 mutate / finalUrl 정정</p>
        <p className="text-xs mt-1">
          개별 광고 finalUrl/headline/description 변경은 Worker
          <code className="bg-white px-1 mx-1 rounded">POST /api/google-ads/internal/update-ad-fields</code> 사용.
        </p>
      </div>
    </div>
  );
}
