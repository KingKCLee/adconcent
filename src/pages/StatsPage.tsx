import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  TrendingUp,
  MousePointerClick,
  CircleDollarSign,
  Target,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { workerFetch } from '@/lib/api';
import { useSite } from '@/contexts/SiteContext';

type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

interface DailyRow {
  date: string;
  impCnt: number;
  clkCnt: number;
  salesAmt: number;
  crto?: number;
}

interface CampaignRow {
  campaign_id?: string;
  name: string;
  impCnt: number;
  clkCnt: number;
  salesAmt: number;
  crto?: number;
}

interface KeywordStat {
  keyword: string;
  current_rank: number | null;
  current_bid: number;
  impCnt?: number;
  clkCnt?: number;
  salesAmt?: number;
}

interface NaverStatsResponse {
  daily?: DailyRow[];
  campaigns?: CampaignRow[];
  totals?: { impCnt: number; clkCnt: number; salesAmt: number; crto: number };
  ids?: string[];
}

const won = (n: number) => `₩${(n ?? 0).toLocaleString()}`;
const num = (n: number) => (n ?? 0).toLocaleString();

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

function rangeToDates(r: RangeKey, custom?: { since: string; until: string }) {
  const today = new Date();
  const t = fmtDate(today);
  if (r === 'today') return { since: t, until: t };
  if (r === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const ys = fmtDate(y);
    return { since: ys, until: ys };
  }
  if (r === '7d') {
    const s = new Date(today);
    s.setDate(s.getDate() - 6);
    return { since: fmtDate(s), until: t };
  }
  if (r === '30d') {
    const s = new Date(today);
    s.setDate(s.getDate() - 29);
    return { since: fmtDate(s), until: t };
  }
  return custom ?? { since: t, until: t };
}

export function StatsPage() {
  const { siteId } = useSite();
  const [range, setRange] = useState<RangeKey>('7d');
  const [customSince, setCustomSince] = useState<string>(fmtDate(new Date()));
  const [customUntil, setCustomUntil] = useState<string>(fmtDate(new Date()));

  const [loading, setLoading] = useState(false);
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<NaverStatsResponse | null>(null);
  const [keywords, setKeywords] = useState<KeywordStat[]>([]);

  const dates = useMemo(
    () => rangeToDates(range, { since: customSince, until: customUntil }),
    [range, customSince, customUntil],
  );

  const loadStats = async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      // 1단계: 캠페인 목록 조회
      let campaignIds: string[] = [];
      const campaignNames = new Map<string, string>();
      try {
        const campRes = await workerFetch<{ data?: any; campaigns?: any[] }>('/naver', {
          method: 'POST',
          body: JSON.stringify({
            site_id: siteId,
            method: 'GET',
            path: '/ncc/campaigns',
          }),
        });
        const list: any[] = Array.isArray(campRes?.data)
          ? campRes.data
          : Array.isArray(campRes?.campaigns)
          ? campRes.campaigns!
          : [];
        for (const c of list) {
          const id = c.nccCampaignId ?? c.campaignId ?? c.id;
          if (id) {
            campaignIds.push(id);
            campaignNames.set(id, c.name ?? c.campaignName ?? id);
          }
        }
      } catch {
        // 캠페인 조회 실패 시 빈 ids로 stats 호출 (Worker가 전체 처리하도록)
      }

      // 2단계: 통계 조회
      const res = await workerFetch<NaverStatsResponse>('/naver/stats', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          ids: campaignIds,
          timeRange: { since: dates.since, until: dates.until },
          fields: ['clkCnt', 'impCnt', 'salesAmt', 'crto'],
          idType: 'campaign',
          timeUnit: 'day',
        }),
      });

      // 캠페인명 매핑
      if (res.campaigns && campaignNames.size > 0) {
        res.campaigns = res.campaigns.map((c: any) => ({
          ...c,
          name: campaignNames.get(c.campaign_id ?? c.id) ?? c.name ?? c.campaign_id,
        }));
      }
      setStats(res);
    } catch (e: any) {
      setError(e?.message ?? '실적 조회 실패');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const loadKeywords = async () => {
    if (!siteId) return;
    setKeywordsLoading(true);
    try {
      const data = await workerFetch<{ keywords?: KeywordStat[] } | KeywordStat[]>(
        `/naver/keyword-stats?site_id=${siteId}`,
      );
      const list = Array.isArray(data) ? data : data?.keywords ?? [];
      setKeywords(list);
    } catch {
      setKeywords([]);
    } finally {
      setKeywordsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.since, dates.until, siteId]);

  useEffect(() => {
    loadKeywords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const totals = useMemo(() => {
    if (stats?.totals) return stats.totals;
    const d = stats?.daily ?? [];
    return d.reduce(
      (acc, r) => ({
        impCnt: acc.impCnt + (r.impCnt ?? 0),
        clkCnt: acc.clkCnt + (r.clkCnt ?? 0),
        salesAmt: acc.salesAmt + (r.salesAmt ?? 0),
        crto: acc.crto + (r.crto ?? 0),
      }),
      { impCnt: 0, clkCnt: 0, salesAmt: 0, crto: 0 },
    );
  }, [stats]);

  const avgCpc = totals.clkCnt > 0 ? Math.round(totals.salesAmt / totals.clkCnt) : 0;

  const sortedCampaigns = useMemo(() => {
    const list = [...(stats?.campaigns ?? [])];
    list.sort((a, b) => (b.salesAmt ?? 0) - (a.salesAmt ?? 0));
    return list;
  }, [stats]);

  const sortedKeywords = useMemo(() => {
    const list = [...keywords];
    list.sort((a, b) => (b.salesAmt ?? 0) - (a.salesAmt ?? 0));
    return list;
  }, [keywords]);

  const dailyRows = stats?.daily ?? [];
  const hasData = dailyRows.length > 0 || sortedCampaigns.length > 0;

  const kpis = [
    {
      label: '총 광고비',
      value: won(totals.salesAmt),
      icon: CircleDollarSign,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '총 클릭수',
      value: num(totals.clkCnt),
      icon: MousePointerClick,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: '평균 CPC',
      value: won(avgCpc),
      icon: TrendingUp,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: '전환수',
      value: num(Math.round(totals.crto ?? 0)),
      icon: Target,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {(
            [
              { id: 'today', label: '오늘' },
              { id: 'yesterday', label: '어제' },
              { id: '7d', label: '7일' },
              { id: '30d', label: '30일' },
              { id: 'custom', label: '직접입력' },
            ] as { id: RangeKey; label: string }[]
          ).map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                range === r.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customSince}
              onChange={(e) => setCustomSince(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={customUntil}
              onChange={(e) => setCustomUntil(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        <span className="text-xs text-gray-400">
          {dates.since} ~ {dates.until}
        </span>
      </div>

      {/* 에러/빈 상태 */}
      {error && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">실적 데이터를 불러올 수 없습니다</p>
            <p className="text-xs text-amber-700 mt-1">{error}</p>
            <Link
              to="/dashboard/settings"
              className="inline-block mt-3 text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              네이버 광고 계정 연결
            </Link>
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-300" /> : value}
            </p>
          </div>
        ))}
      </div>

      {/* 차트 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">일자별 성과</h3>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="h-72 flex items-center justify-center text-sm text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : dailyRows.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v) => `₩${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: any, name: string) =>
                    name === '광고비' ? won(Number(value)) : num(Number(value))
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="salesAmt"
                  name="광고비"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="clkCnt"
                  name="클릭수"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 캠페인별 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">캠페인별 성과</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            불러오는 중...
          </div>
        ) : sortedCampaigns.length === 0 ? (
          <EmptyState compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">캠페인명</th>
                  <th className="px-3 py-3 font-medium text-right">노출수</th>
                  <th className="px-3 py-3 font-medium text-right">클릭수</th>
                  <th className="px-3 py-3 font-medium text-right">클릭률</th>
                  <th className="px-3 py-3 font-medium text-right">광고비</th>
                  <th className="px-3 py-3 font-medium text-right">평균CPC</th>
                  <th className="px-3 py-3 font-medium text-right">전환수</th>
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map((c, i) => {
                  const ctr = c.impCnt > 0 ? ((c.clkCnt / c.impCnt) * 100).toFixed(2) : '0.00';
                  const cpc = c.clkCnt > 0 ? Math.round(c.salesAmt / c.clkCnt) : 0;
                  return (
                    <tr key={c.campaign_id ?? i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{num(c.impCnt)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{num(c.clkCnt)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{ctr}%</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(c.salesAmt)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{won(cpc)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{num(Math.round(c.crto ?? 0))}</td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-4 py-3 text-gray-900">합계</td>
                  <td className="px-3 py-3 text-right text-gray-900">{num(totals.impCnt)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{num(totals.clkCnt)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">
                    {totals.impCnt > 0 ? ((totals.clkCnt / totals.impCnt) * 100).toFixed(2) : '0.00'}%
                  </td>
                  <td className="px-3 py-3 text-right text-gray-900">{won(totals.salesAmt)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{won(avgCpc)}</td>
                  <td className="px-3 py-3 text-right text-gray-900">{num(Math.round(totals.crto ?? 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 키워드별 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">키워드별 성과</h3>
        </div>
        {keywordsLoading ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            불러오는 중...
          </div>
        ) : sortedKeywords.length === 0 ? (
          <EmptyState compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">키워드</th>
                  <th className="px-3 py-3 font-medium text-center">현재순위</th>
                  <th className="px-3 py-3 font-medium text-right">입찰가</th>
                  <th className="px-3 py-3 font-medium text-right">노출수</th>
                  <th className="px-3 py-3 font-medium text-right">클릭수</th>
                  <th className="px-3 py-3 font-medium text-right">광고비</th>
                </tr>
              </thead>
              <tbody>
                {sortedKeywords.map((k, i) => (
                  <tr key={`${k.keyword}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{k.keyword}</td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {k.current_rank == null ? <span className="text-gray-400">노출없음</span> : `${k.current_rank}위`}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{won(k.current_bid)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{num(k.impCnt ?? 0)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{num(k.clkCnt ?? 0)}</td>
                    <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(k.salesAmt ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!hasData && !loading && !error && <ConnectPrompt />}
    </div>
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`text-center text-sm text-gray-400 ${compact ? 'py-12' : 'h-72 flex items-center justify-center'}`}>
      이 기간에 데이터가 없습니다
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 rounded-xl p-6 text-center">
      <h4 className="font-semibold text-gray-900 mb-2">네이버 광고 계정을 연결하면 실적 데이터가 표시됩니다</h4>
      <p className="text-sm text-gray-600 mb-4">계정 연결 후 자동으로 광고비·클릭·전환 데이터가 동기화됩니다.</p>
      <Link
        to="/dashboard/settings"
        className="inline-block text-sm px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        설정으로 이동
      </Link>
    </div>
  );
}
