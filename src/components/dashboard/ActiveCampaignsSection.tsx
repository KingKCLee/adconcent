import { useEffect, useState } from 'react';
import CampaignListCard, { type Campaign } from './CampaignListCard';

interface Props {
  channelType?: 'ALL' | 'SEARCH' | 'YOUTUBE' | 'DEMAND_GEN' | 'DISPLAY' | 'VIDEO' | 'PERFORMANCE_MAX';
  customerId?: string;
  title?: string;
  emoji?: string;
}

const WORKER_URL =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_ADCONCENT_WORKER_URL ||
  'https://adconcent.com';

export default function ActiveCampaignsSection({
  channelType = 'ALL',
  customerId = '1581690943',
  title = '활성 Google Ads 캠페인',
  emoji = '🎯',
}: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = `${WORKER_URL}/api/campaigns?customer_id=${customerId}&channel_type=${channelType}`;
    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: { campaigns?: Campaign[] }) => {
        setCampaigns(d.campaigns || []);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
  }, [channelType, customerId]);

  // 활성(ENABLED) 우선, PAUSED 후순위로 정렬
  const sorted = [...campaigns].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === 'ENABLED' ? -1 : 1;
  });

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          {emoji} {title}
        </h2>
        <span className="text-sm text-gray-500">
          {!loading && `총 ${sorted.length}개`}
        </span>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">로딩 중...</div>}
      {error && <div className="text-center py-8 text-red-600">에러: {error}</div>}

      {!loading && !error && sorted.length === 0 && (
        <div className="text-center py-8 text-gray-500">활성 캠페인이 없습니다.</div>
      )}

      {!loading && !error && sorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((c) => (
            <CampaignListCard key={c.campaign_id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
