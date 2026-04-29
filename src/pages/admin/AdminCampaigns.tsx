import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { workerFetch } from '@/lib/api';

interface ChannelCost {
  channels: {
    google: number;
    naver: number;
    kakao: number;
    meta: number;
  };
}

export default function AdminCampaigns() {
  const { siteId } = useSite();
  const [channels, setChannels] = useState<ChannelCost['channels'] | null>(null);

  useEffect(() => {
    workerFetch<ChannelCost>('/api/admin/dashboard/channel-cost')
      .then((r) => setChannels(r.channels))
      .catch(() => {});
  }, [siteId]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">캠페인</h1>
      <p className="text-sm text-gray-500">매체별 캠페인 성과 — 깊이 분석은 사이드바 매체별 메뉴.</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { label: '구글', val: channels?.google, color: '#4285F4' },
          { label: '네이버', val: channels?.naver, color: '#03C75A' },
          { label: '카카오', val: channels?.kakao, color: '#FFCD00' },
          { label: '메타', val: channels?.meta, color: '#1877F2' },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: c.color }}>{c.label}</div>
            <div className="text-2xl font-bold text-gray-900">{c.val?.toLocaleString() ?? '—'}</div>
            <div className="text-[11px] text-gray-400 mt-1">30d 클릭</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-600">
        시흥거모B1 + DemandGen LIVE 캠페인은 <a href="/admin/google/campaigns" className="text-blue-600 underline">구글 캠페인 관리</a>에서 mutate 가능합니다.
      </div>
    </div>
  );
}
