import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { workerFetch } from '@/lib/api';

export default function AdminSites() {
  const { sites, refresh } = useSite();
  const [pixelCode, setPixelCode] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  async function loadPixel(siteId: string) {
    if (pixelCode[siteId]) return;
    try {
      const r = await workerFetch<{ code: string }>(`/api/admin/pixel/code/${siteId}`);
      setPixelCode((p) => ({ ...p, [siteId]: r.code }));
    } catch { /* noop */ }
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">사이트</h1>
      <p className="text-sm text-gray-500">멀티 사이트 + AdConcent 픽셀 1-click 설치.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sites.map((s) => (
          <div key={s.site_id} className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">{s.domain || s.site_id}</div>
                <div className="text-xs text-gray-500">{s.site_id} · {String(s.plan).toUpperCase()}</div>
              </div>
              <button
                onClick={() => loadPixel(s.site_id)}
                className="text-xs px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                픽셀 코드
              </button>
            </div>

            <div className="mt-3 flex gap-2 text-[11px]">
              <span className={s.naver_customer_id ? 'bg-green-100 text-green-800 px-2 py-0.5 rounded' : 'bg-gray-100 text-gray-500 px-2 py-0.5 rounded'}>
                Naver {s.naver_customer_id ? '✓' : '—'}
              </span>
            </div>

            {pixelCode[s.site_id] && (
              <div className="mt-3 relative">
                <pre className="bg-gray-900 text-gray-100 text-[10px] p-3 rounded overflow-auto max-h-40 font-mono">
                  {pixelCode[s.site_id]}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixelCode[s.site_id]);
                    setCopied(s.site_id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded"
                >
                  {copied === s.site_id ? '복사됨' : '복사'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {sites.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-12">등록된 사이트가 없습니다.</div>
      )}
    </div>
  );
}
