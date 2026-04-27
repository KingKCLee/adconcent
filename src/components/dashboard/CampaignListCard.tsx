import { useNavigate } from 'react-router-dom';

export interface Campaign {
  campaign_id: string;
  name: string;
  status: string;
  serving_status: string;
  channel_type: string;
  daily_budget: number;
  impressions_7d: number;
  clicks_7d: number;
  cost_7d: number;
  conversions_7d: number;
}

const CHANNEL_LABEL: Record<string, string> = {
  SEARCH: '검색',
  DEMAND_GEN: 'DemandGen',
  DISPLAY: '디스플레이',
  VIDEO: '비디오',
  PERFORMANCE_MAX: 'PMax',
};

export default function CampaignListCard({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();

  const ctr = campaign.impressions_7d > 0
    ? ((campaign.clicks_7d / campaign.impressions_7d) * 100).toFixed(2)
    : '0';

  const cpa = campaign.conversions_7d > 0
    ? Math.round(campaign.cost_7d / campaign.conversions_7d)
    : 0;

  const statusBadge =
    campaign.status === 'ENABLED'
      ? 'bg-green-100 text-green-700'
      : campaign.status === 'PAUSED'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-gray-100 text-gray-700';

  return (
    <div
      onClick={() => navigate(`/dashboard/campaigns/${campaign.campaign_id}`)}
      className="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer p-4 border border-gray-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
          <div className="flex gap-2 mt-1 text-xs">
            <span className={`px-2 py-0.5 rounded ${statusBadge}`}>{campaign.status}</span>
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
              {CHANNEL_LABEL[campaign.channel_type] || campaign.channel_type}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 flex-shrink-0 ml-2">
          ID {campaign.campaign_id}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-xs text-gray-500">노출(7d)</div>
          <div className="font-semibold">{campaign.impressions_7d.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">클릭(7d)</div>
          <div className="font-semibold">{campaign.clicks_7d.toLocaleString()}</div>
          <div className="text-xs text-gray-400">CTR {ctr}%</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">비용(7d)</div>
          <div className="font-semibold">₩{campaign.cost_7d.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">전환(7d)</div>
          <div className="font-semibold">{campaign.conversions_7d.toFixed(1)}</div>
          {cpa > 0 && <div className="text-xs text-gray-400">CPA ₩{cpa.toLocaleString()}</div>}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
        <span>일 예산 ₩{campaign.daily_budget.toLocaleString()}</span>
        <span className="text-blue-600">상세 보기 →</span>
      </div>
    </div>
  );
}
