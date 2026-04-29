import { useEffect, useState } from 'react';
import { workerFetch } from '@/lib/api';

interface CampaignRow {
  campaign_id: string;
  name: string;
  status: string;
  budget_krw: number | null;
  cost_today: number;
  clicks_today: number;
  conversions_today: number;
  lp_form_submits: number;
  phone_clicks: number;
  last_synced_at: number | null;
}

export default function AdminCampaigns() {
  const [google, setGoogle] = useState<CampaignRow[]>([]);
  const [naver, setNaver] = useState<CampaignRow[]>([]);
  const [lastSynced, setLastSynced] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    workerFetch<{ google: CampaignRow[]; naver: CampaignRow[]; last_synced: string }>('/api/admin/campaigns')
      .then((r) => {
        setGoogle(r.google || []);
        setNaver(r.naver || []);
        setLastSynced(r.last_synced || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const all = [...google, ...naver];
  const totalCost = all.reduce((s, c) => s + (c.cost_today || 0), 0);
  const totalClicks = all.reduce((s, c) => s + (c.clicks_today || 0), 0);
  const totalConv = all.reduce((s, c) => s + (c.conversions_today || 0), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">캠페인 (4채널 통합)</h1>
      <p className="text-sm text-gray-500">
        매시 정각 cron 동기화 · {lastSynced ? `last_synced ${new Date(lastSynced).toLocaleString('ko-KR')}` : '동기화 대기'}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="오늘 광고비" value={`₩${totalCost.toLocaleString()}`} />
        <KPI label="오늘 클릭" value={totalClicks.toLocaleString()} />
        <KPI label="오늘 전환" value={totalConv.toLocaleString()} />
        <KPI label="활성 캠페인" value={`${google.length + naver.length}`} sub={`구글 ${google.length} · 네이버 ${naver.length}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChannelSection
          label="구글 광고"
          color="#4285F4"
          campaigns={google}
          loading={loading}
          emptyHint="campaigns 테이블 또는 매시 cron 미동기화"
        />
        <ChannelSection
          label="네이버 검색광고"
          color="#03C75A"
          campaigns={naver}
          loading={loading}
          emptyHint="네이버 캠페인은 /workspace/naver 메뉴에서 조회"
        />
      </div>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ChannelSection({
  label,
  color,
  campaigns,
  loading,
  emptyHint,
}: {
  label: string;
  color: string;
  campaigns: CampaignRow[];
  loading: boolean;
  emptyHint: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h2 className="font-bold text-sm" style={{ color }}>
          {label} ({campaigns.length})
        </h2>
      </div>
      {loading ? (
        <div className="text-xs text-gray-400 py-6 text-center">로드 중...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-xs text-gray-400 py-6 text-center">{emptyHint}</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-gray-500">
            <tr className="border-b border-gray-100">
              <th className="text-left py-1.5">캠페인</th>
              <th className="text-center">상태</th>
              <th className="text-right">비용</th>
              <th className="text-right">클릭</th>
              <th className="text-right">전환</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.slice(0, 10).map((c) => (
              <tr key={c.campaign_id} className="border-b border-gray-50">
                <td className="py-1.5 truncate max-w-[180px]">{c.name}</td>
                <td className="text-center">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      c.status === 'ENABLED' || c.status === 'ELIGIBLE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="text-right">₩{(c.cost_today || 0).toLocaleString()}</td>
                <td className="text-right">{c.clicks_today || 0}</td>
                <td className="text-right">{c.conversions_today || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
