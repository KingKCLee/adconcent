import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { workerFetch } from '@/lib/api';

interface FraudStats {
  total_24h: number;
  suspicious_24h: number;
  blocked_total: number;
  rate_pct: number;
}

export default function NaverClickFraud() {
  const { siteId } = useSite();
  const [stats, setStats] = useState<FraudStats | null>(null);
  const [pixel, setPixel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    workerFetch<FraudStats>('/api/admin/dashboard/fraud').then(setStats).catch(() => {});
    if (siteId) {
      workerFetch<{ code: string }>(`/api/admin/pixel/code/${siteId}`)
        .then((r) => setPixel(r.code))
        .catch(() => {});
    }
  }, [siteId]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#03C75A]" />
        <h1 className="text-xl font-bold text-gray-900">네이버 부정클릭 방지</h1>
      </div>
      <p className="text-sm text-gray-500">
        autoBlock cron 5분 LIVE · 인앱(NAVER/KAKAOTALK 등) 화이트리스트 적용.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="24h 클릭" value={stats?.total_24h.toLocaleString()} />
        <Card label="24h 의심" value={stats?.suspicious_24h.toLocaleString()} accent="text-orange-600" />
        <Card label="누적 차단 IP" value={stats?.blocked_total.toLocaleString()} accent="text-red-600" />
        <Card label="부정 비율" value={stats ? `${stats.rate_pct}%` : '—'} accent={stats && stats.rate_pct >= 10 ? 'text-red-600' : ''} />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
        <p className="font-bold">📄 환불 신청 자동 spec</p>
        <p className="text-xs mt-1">네이버 부정클릭 환불은 월 1회 신청 가능 — blocked_ips 데이터 기반 PDF는 다음 sprint.</p>
      </div>

      {pixel && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm">픽셀 설치 코드</h2>
            <button
              onClick={() => {
                navigator.clipboard.writeText(pixel);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-xs px-2 py-1 bg-[#03C75A] text-white rounded">
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 text-[10px] p-3 rounded overflow-auto max-h-40 font-mono">
            {pixel}
          </pre>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, accent = '' }: { label: string; value?: string | number; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className={`text-xl font-bold text-gray-900 ${accent}`}>{value ?? '...'}</div>
    </div>
  );
}
