import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import CampaignKPICard from '@/components/dashboard/CampaignKPICard';

interface NetworkBucket {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpa: number;
}

interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  status: string;
  serving_status: string;
  advertising_channel_type: string;
  total_impressions: number;
  total_clicks: number;
  total_cost: number;
  total_conversions: number;
  cpc: number;
  cpa: number;
  ctr: number;
  cvr: number;
  form_submits: number;
  phone_clicks: number;
  form_vs_phone_ratio: number;
  network_breakdown: { youtube: NetworkBucket; discover: NetworkBucket; search: NetworkBucket };
  device_breakdown: { mobile: number; desktop: number; tablet: number; ctv: number };
  fraud_metrics: {
    total_clicks: number;
    suspicious_clicks: number;
    suspicious_ratio: number;
    blocked_ips: number;
  };
  hourly_data: Array<{
    hour: number;
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
  }>;
  search_keywords: Array<{
    keyword: string;
    quality_score: number | null;
    impressions: number;
    clicks: number;
    cost: number;
  }> | null;
}

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CampaignMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('7d');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`${WORKER_URL}/api/campaigns/${id}/metrics?range=${timeRange}`, {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message);
        setLoading(false);
      });
  }, [id, timeRange]);

  if (loading) return <div className="p-8 text-center text-gray-600">로딩 중...</div>;
  if (error) return <div className="p-8 text-red-600">에러: {error}</div>;
  if (!data) return <div className="p-8">데이터 없음</div>;

  const totalDeviceConv =
    data.device_breakdown.mobile +
    data.device_breakdown.desktop +
    data.device_breakdown.tablet +
    data.device_breakdown.ctv;
  const mobileShare =
    totalDeviceConv === 0 ? 100 : Math.round((data.device_breakdown.mobile / totalDeviceConv) * 100);

  const searchCTR =
    data.network_breakdown.search.impressions > 0
      ? ((data.network_breakdown.search.clicks / data.network_breakdown.search.impressions) * 100).toFixed(2)
      : '0';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.campaign_name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            ID: {data.campaign_id} · 채널: {data.advertising_channel_type} · 상태:{' '}
            <span className={data.status === 'ENABLED' ? 'text-green-600 font-medium' : 'text-orange-600'}>
              {data.status}
            </span>
            {' '}({data.serving_status})
          </p>
        </div>
        <div className="flex gap-2">
          {(['today', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded text-sm ${
                timeRange === r
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {r === 'today' ? '오늘' : r === '7d' ? '7일' : '30일'}
            </button>
          ))}
        </div>
      </div>

      {/* 5단계 모니터링 KPI */}
      <h2 className="text-lg font-semibold mb-3">🎯 리드 증대 5단계 모니터링</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <CampaignKPICard
          label="🔴 1단계: 폼/전화 비율"
          value={`${data.form_submits}/${data.phone_clicks}`}
          subtitle={data.form_vs_phone_ratio < 0.1 ? '⚠️ 폼 도달률 저조' : '정상'}
          status={data.form_vs_phone_ratio < 0.1 ? 'critical' : 'ok'}
        />
        <CampaignKPICard
          label="🔴 2단계: DISCOVER CPA"
          value={`₩${data.network_breakdown.discover.cpa.toLocaleString()}`}
          subtitle={data.network_breakdown.discover.cpa > 30000 ? '⚠️ 비효율' : 'OK'}
          status={data.network_breakdown.discover.cpa > 30000 ? 'critical' : 'ok'}
        />
        <CampaignKPICard
          label="🔴 3단계: 모바일 비중"
          value={`${mobileShare}%`}
          subtitle={mobileShare < 90 ? '디바이스 입찰 점검' : 'OK'}
          status={mobileShare < 90 ? 'warning' : 'ok'}
        />
        <CampaignKPICard
          label="🟡 4단계: Search CTR"
          value={`${searchCTR}%`}
          subtitle={data.network_breakdown.search.clicks === 0 ? '⚠️ 클릭 0' : 'OK'}
          status={
            data.network_breakdown.search.clicks === 0 && data.network_breakdown.search.impressions > 50
              ? 'critical'
              : 'ok'
          }
        />
        <CampaignKPICard
          label="🟡 5단계: 부정클릭"
          value={`${(data.fraud_metrics.suspicious_ratio * 100).toFixed(1)}%`}
          subtitle={`차단 IP: ${data.fraud_metrics.blocked_ips}`}
          status={
            data.fraud_metrics.suspicious_ratio > 0.3
              ? 'critical'
              : data.fraud_metrics.suspicious_ratio > 0.1
              ? 'warning'
              : 'ok'
          }
        />
      </div>

      {/* 일반 KPI */}
      <h2 className="text-lg font-semibold mb-3">📊 캠페인 KPI</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <CampaignKPICard label="총 노출" value={data.total_impressions.toLocaleString()} />
        <CampaignKPICard
          label="총 클릭"
          value={data.total_clicks.toLocaleString()}
          subtitle={`CTR ${(data.ctr * 100).toFixed(2)}%`}
        />
        <CampaignKPICard
          label="총 비용"
          value={`₩${data.total_cost.toLocaleString()}`}
          subtitle={`CPC ₩${data.cpc.toLocaleString()}`}
        />
        <CampaignKPICard
          label="전환수"
          value={data.total_conversions.toFixed(1)}
          subtitle={data.total_conversions > 0 ? `CPA ₩${data.cpa.toLocaleString()}` : 'CVR 0%'}
        />
      </div>

      {/* 시간대별 차트 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-semibold mb-3">⏰ 시간대별 추이</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.hourly_data}>
            <XAxis dataKey="hour" tickFormatter={(h: number) => `${h}시`} />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              formatter={(v: number, n: string) =>
                n === '비용' ? `₩${v.toLocaleString()}` : v.toLocaleString()
              }
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="impressions" stroke="#3B82F6" name="노출" strokeWidth={2} />
            <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#10B981" name="클릭" strokeWidth={2} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="conversions"
              stroke="#EF4444"
              name="전환"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 네트워크 + 디바이스 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">📱 광고 네트워크별 효율</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={[
                {
                  name: 'YouTube',
                  클릭: data.network_breakdown.youtube.clicks,
                  전환: data.network_breakdown.youtube.conversions,
                },
                {
                  name: 'DISCOVER',
                  클릭: data.network_breakdown.discover.clicks,
                  전환: data.network_breakdown.discover.conversions,
                },
                {
                  name: 'Search',
                  클릭: data.network_breakdown.search.clicks,
                  전환: data.network_breakdown.search.conversions,
                },
              ]}
            >
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="클릭" fill="#3B82F6" />
              <Bar dataKey="전환" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">📲 디바이스별 전환</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: '모바일', value: data.device_breakdown.mobile },
                  { name: '데스크톱', value: data.device_breakdown.desktop },
                  { name: '태블릿', value: data.device_breakdown.tablet },
                  { name: 'CTV', value: data.device_breakdown.ctv },
                ].filter((d) => d.value > 0)}
                dataKey="value"
                nameKey="name"
                label={({ name, value }: { name?: string; value?: number }) =>
                  `${name} ${(value ?? 0).toFixed(1)}`
                }
                outerRadius={80}
              >
                {['#10B981', '#6B7280', '#9CA3AF', '#D1D5DB'].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Search 키워드 */}
      {data.search_keywords && data.search_keywords.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-semibold mb-3">🔍 Search 키워드 진단</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">키워드</th>
                  <th className="p-2 text-right">노출</th>
                  <th className="p-2 text-right">클릭</th>
                  <th className="p-2 text-right">QS</th>
                  <th className="p-2 text-right">비용</th>
                  <th className="p-2 text-center">진단</th>
                </tr>
              </thead>
              <tbody>
                {data.search_keywords.map((kw, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-2">{kw.keyword}</td>
                    <td className="p-2 text-right">{kw.impressions}</td>
                    <td className="p-2 text-right">{kw.clicks}</td>
                    <td className="p-2 text-right">{kw.quality_score ?? '-'}</td>
                    <td className="p-2 text-right">₩{kw.cost.toLocaleString()}</td>
                    <td className="p-2 text-center">
                      {kw.clicks === 0 && kw.impressions > 50 ? (
                        <span className="text-red-600 text-xs">⚠️ 카피 검토</span>
                      ) : kw.quality_score !== null && kw.quality_score < 5 ? (
                        <span className="text-orange-600 text-xs">QS 저조</span>
                      ) : (
                        <span className="text-green-600 text-xs">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
