import { useEffect, useState } from 'react';
import { workerFetch } from '@/lib/api';

interface MeResponse {
  tenant: { id: number; name: string; plan_tier: string; owner_email: string };
  sites: Array<{ site_id: string; domain: string; google_connected: number }>;
}

export default function GoogleSettings() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    workerFetch<MeResponse>('/api/admin/tenant/me')
      .then(setMe)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
        <h1 className="text-xl font-bold text-gray-900">구글 광고 설정</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl">
        <h2 className="font-bold text-sm mb-3">customer_id</h2>
        <div className="font-mono text-sm bg-gray-50 px-3 py-2 rounded">1581690943 (시흥거모B1 LIVE)</div>
        <p className="text-xs text-gray-500 mt-2">tenant_id={me?.tenant?.id ?? '—'} · plan {me?.tenant?.plan_tier ?? '—'}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl">
        <h2 className="font-bold text-sm mb-3">Google 연결 상태</h2>
        {me ? (
          <ul className="text-sm space-y-1.5">
            {me.sites.map((s) => (
              <li key={s.site_id} className="flex items-center justify-between">
                <span>{s.domain || s.site_id}</span>
                <span className={s.google_connected ? 'text-green-600' : 'text-gray-400'}>
                  {s.google_connected ? '✓ 연결됨' : '— 미연결'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">로드 중...</p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl">
        <h2 className="font-bold text-sm mb-3">tracking_url_template</h2>
        <pre className="bg-gray-50 px-3 py-2 rounded text-xs font-mono overflow-x-auto">
{`{lpurl}?utm_source={network}&utm_medium={device}&gclid={gclid}`}
        </pre>
        <p className="text-xs text-gray-500 mt-2">매크로 정정 시 lpurl 캐시 무효화 자동.</p>
      </div>
    </div>
  );
}
