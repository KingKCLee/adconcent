import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNaverApi } from '@/hooks/useNaverApi';
import { useAdAccount } from '@/hooks/useAdAccount';
import { fetchTotalStats, fetchKeywordStats, type NaverStatRow } from '@/lib/naverApi';
import { supabase } from '@/lib/supabase';
import { getCached, setCache } from '@/lib/cache';
import AutoAdjustmentBanner from './AutoAdjustmentBanner';
import KeywordDailyTable from './KeywordDailyTable';
import ZeroImpressionAlert from './ZeroImpressionAlert';
import HelpTooltip from '@/components/common/HelpTooltip';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Line, LineChart, Legend,
} from 'recharts';
import {
  Loader2, Wallet, TrendingUp, MousePointerClick, DollarSign,
  ArrowDown, ArrowUp, RotateCw, Trophy, Zap, Shield, Sparkles,
  Check, X as XIcon, CalendarDays,
} from 'lucide-react';

interface Props { adAccountId: string | undefined }

interface TopKeywordRow { keyword: string; clicks: number; cost: number; cpc: number; conversions: number; cpa: number }
interface CompetitorRow { keyword: string; ourBid: number; compBid: number; delta: number }
interface BidLogItem { id: string; keyword: string; from: number; to: number; reason: string; createdAt: string }
interface RankPoint { date: string; [kw: string]: string | number }

interface Suggestion {
  id: string;
  type: 'bid' | 'keyword' | 'budget' | 'time';
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'ignored';
}

type Period = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

const fmtDate = (d: Date) => d.toISOString().split('T')[0];

function getPeriodDates(period: Period, customStart: string, customEnd: string) {
  const now = new Date();
  switch (period) {
    case 'today': return { start: fmtDate(now), end: fmtDate(now) };
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate() - 1); return { start: fmtDate(y), end: fmtDate(y) }; }
    case '7days': { const s = new Date(now); s.setDate(s.getDate() - 6); return { start: fmtDate(s), end: fmtDate(now) }; }
    case '30days': { const s = new Date(now); s.setDate(s.getDate() - 29); return { start: fmtDate(s), end: fmtDate(now) }; }
    case 'custom': return { start: customStart || fmtDate(now), end: customEnd || fmtDate(now) };
  }
}

const PERIOD_LABELS: { key: Period; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'yesterday', label: '어제' },
  { key: '7days', label: '7일' },
  { key: '30days', label: '30일' },
  { key: 'custom', label: '직접입력' },
];

const RANK_COLORS = ['#093687', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#64748B'];

export default function AdDashboard({ adAccountId }: Props) {
  const { account } = useAdAccount();
  const { bizMoney, fetchBizMoney } = useNaverApi(adAccountId);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tableDays, setTableDays] = useState(7);
  const [period, setPeriod] = useState<Period>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [periodStats, setPeriodStats] = useState<NaverStatRow[]>([]);
  const [prevPeriodCost, setPrevPeriodCost] = useState(0);
  const [dailyStats, setDailyStats] = useState<NaverStatRow[]>([]);
  const [topKeywords, setTopKeywords] = useState<TopKeywordRow[]>([]);
  const [competitorRows, setCompetitorRows] = useState<CompetitorRow[]>([]);
  const [bidLogs, setBidLogs] = useState<BidLogItem[]>([]);
  const [savingsMonth, setSavingsMonth] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [conversions, setConversions] = useState(0);
  const [rankData, setRankData] = useState<RankPoint[]>([]);
  const [rankKeywords, setRankKeywords] = useState<string[]>([]);

  const [showSpend, setShowSpend] = useState(true);
  const [showClicks, setShowClicks] = useState(true);
  const [showConversions, setShowConversions] = useState(true);

  const [aiSuggestions, setAiSuggestions] = useState<Suggestion[]>([]);

  const dates = useMemo(() => getPeriodDates(period, customStart, customEnd), [period, customStart, customEnd]);

  interface DashboardSnapshot {
    periodStats: NaverStatRow[];
    prevPeriodCost: number;
    dailyStats: NaverStatRow[];
    topKeywords: TopKeywordRow[];
    competitorRows: CompetitorRow[];
    bidLogs: BidLogItem[];
    savingsMonth: number;
    blockedCount: number;
    conversions: number;
    rankData: RankPoint[];
    rankKeywords: string[];
  }
  const CACHE_TTL = 3 * 60 * 1000;
  const cacheKey = adAccountId ? `dash2:${adAccountId}:${period}:${dates.start}:${dates.end}` : '';

  const applySnap = useCallback((s: DashboardSnapshot) => {
    setPeriodStats(s.periodStats); setPrevPeriodCost(s.prevPeriodCost);
    setDailyStats(s.dailyStats); setTopKeywords(s.topKeywords);
    setCompetitorRows(s.competitorRows); setBidLogs(s.bidLogs);
    setSavingsMonth(s.savingsMonth); setBlockedCount(s.blockedCount);
    setConversions(s.conversions); setRankData(s.rankData);
    setRankKeywords(s.rankKeywords);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!adAccountId) return;
    const cached = getCached<DashboardSnapshot>(cacheKey, CACHE_TTL);
    if (cached) { applySnap(cached); setLoading(false); setRefreshing(true); }
    else setLoading(true);

    try {
      const { start, end } = dates;
      const prevLen = (new Date(end).getTime() - new Date(start).getTime()) / 86400000 + 1;
      const prevEnd = new Date(new Date(start).getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - (prevLen - 1) * 86400000);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const tgtCamp = account?.targetCampaignId;
      const isMultiDay = start !== end;
      const granularity = isMultiDay ? 'day' : 'hour';

      const [pRes, prevRes, dayRes, bidLogsRes, compBidsRes, monthLogsRes, convRes, blockRes] =
        await Promise.all([
          fetchTotalStats(adAccountId, { since: start, until: end }, granularity, tgtCamp).catch(() => []),
          fetchTotalStats(adAccountId, { since: fmtDate(prevStart), until: fmtDate(prevEnd) }, 'day', tgtCamp).catch(() => []),
          isMultiDay
            ? fetchTotalStats(adAccountId, { since: start, until: end }, 'day', tgtCamp).catch(() => [])
            : Promise.resolve([] as NaverStatRow[]),
          supabase.from('ad_bid_logs').select('id, details, created_at')
            .eq('ad_account_id', adAccountId).order('created_at', { ascending: false }).limit(5),
          supabase.from('competitor_bids').select('keyword, bids, created_at')
            .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
            .order('created_at', { ascending: false }).limit(200),
          supabase.from('ad_bid_logs').select('details')
            .eq('ad_account_id', adAccountId).gte('created_at', monthStart)
            .order('created_at', { ascending: false }).limit(500),
          supabase.from('conversion_logs').select('keyword, created_at')
            .eq('conversion_id', 'viphome_reservation')
            .gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`),
          fetch('https://click-tracker.viphome.kr/stats').then(r => r.json()).catch(() => ({ summary: { blocked: 0 } })),
        ]);

      const freshPrevCost = (prevRes || []).reduce((s, r) => s + (r.salesAmt || 0), 0);
      setPeriodStats(pRes); setPrevPeriodCost(freshPrevCost);
      const freshDailyStats = isMultiDay ? dayRes : pRes;
      setDailyStats(freshDailyStats);

      const freshConversions = convRes.data?.length || 0;
      setConversions(freshConversions);
      setBlockedCount(blockRes?.summary?.blocked || 0);

      const convByKw: Record<string, number> = {};
      for (const c of (convRes.data || [])) {
        const kw = (c.keyword || '').trim();
        if (kw) convByKw[kw] = (convByKw[kw] || 0) + 1;
      }

      // 키워드 성과
      const { data: allKws } = await supabase
        .from('ad_keyword_settings').select('ncc_keyword_id, keyword')
        .eq('ad_account_id', adAccountId);
      const kwIdToName: Record<string, string> = {};
      const kwIds: string[] = [];
      for (const r of (allKws || [])) {
        if (r.ncc_keyword_id && r.keyword) { kwIdToName[r.ncc_keyword_id] = r.keyword; kwIds.push(r.ncc_keyword_id); }
      }
      let freshTopKws: TopKeywordRow[] = [];
      if (kwIds.length > 0) {
        try {
          const kwStats = await fetchKeywordStats(adAccountId, kwIds);
          const agg: Record<string, { clicks: number; cost: number }> = {};
          for (const row of kwStats) {
            const r = row as unknown as { id: string; clkCnt: number; salesAmt: number; statDt?: string };
            if (r.statDt && (r.statDt < start || r.statDt > end)) continue;
            if (!agg[r.id]) agg[r.id] = { clicks: 0, cost: 0 };
            agg[r.id].clicks += r.clkCnt || 0;
            agg[r.id].cost += r.salesAmt || 0;
          }
          freshTopKws = Object.entries(agg)
            .map(([id, v]) => {
              const kw = kwIdToName[id] || id;
              const conv = convByKw[kw] || 0;
              return { keyword: kw, clicks: v.clicks, cost: Math.round(v.cost), cpc: v.clicks > 0 ? Math.round(v.cost / v.clicks) : 0, conversions: conv, cpa: conv > 0 ? Math.round(v.cost / conv) : 0 };
            })
            .filter(r => r.clicks > 0 || r.cost > 0)
            .sort((a, b) => b.clicks - a.clicks || b.cost - a.cost)
            .slice(0, 12);
        } catch { /* ignore */ }
      }
      setTopKeywords(freshTopKws);

      // Competitor
      const compMap: Record<string, number> = {};
      for (const row of (compBidsRes.data || [])) {
        if (compMap[row.keyword] !== undefined) continue;
        const bids = (row.bids || {}) as Record<string, number>;
        const top3 = [bids['1'], bids['2'], bids['3']].filter(v => v > 0);
        if (top3.length === 0) continue;
        compMap[row.keyword] = Math.round(top3.reduce((a, b) => a + b, 0) / top3.length);
      }
      const { data: kwBids } = await supabase
        .from('ad_keyword_settings').select('keyword, max_bid').eq('ad_account_id', adAccountId);
      const ourBidMap: Record<string, number> = {};
      for (const r of (kwBids || [])) { if (r.keyword && r.max_bid) ourBidMap[r.keyword] = r.max_bid; }
      const freshCompRows = Object.entries(compMap)
        .map(([keyword, compBid]) => ({ keyword, ourBid: ourBidMap[keyword] || 0, compBid, delta: compBid > 0 ? Math.round(((ourBidMap[keyword] || 0) - compBid) / compBid * 100) : 0 }))
        .filter(r => r.ourBid > 0).slice(0, 8);
      setCompetitorRows(freshCompRows);

      // Bid logs
      interface DetailsShape { changes?: { keyword: string; currentBid: number; newBid: number; reason: string }[] }
      const recent: BidLogItem[] = [];
      for (const log of (bidLogsRes.data || [])) {
        for (const c of ((log.details as DetailsShape)?.changes || [])) {
          if (!c.keyword || c.currentBid === c.newBid) continue;
          recent.push({ id: `${log.id}-${c.keyword}`, keyword: c.keyword, from: c.currentBid, to: c.newBid, reason: c.reason || '', createdAt: log.created_at });
          if (recent.length >= 5) break;
        }
        if (recent.length >= 5) break;
      }
      setBidLogs(recent);

      // Savings
      let savingSum = 0;
      for (const log of (monthLogsRes.data || [])) {
        for (const c of (((log.details || {}) as DetailsShape).changes || [])) {
          if (c.newBid < c.currentBid) savingSum += (c.currentBid - c.newBid);
        }
      }
      setSavingsMonth(savingSum);

      // Rank trends
      const { data: rankRows } = await supabase
        .from('rank_logs').select('keyword, rank, created_at')
        .eq('ad_account_id', adAccountId)
        .gte('created_at', `${start}T00:00:00`).lte('created_at', `${end}T23:59:59`)
        .order('created_at', { ascending: true }).limit(2000);
      const kwFreq: Record<string, number> = {};
      for (const r of (rankRows || [])) { kwFreq[r.keyword] = (kwFreq[r.keyword] || 0) + 1; }
      const topRankKws = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
      setRankKeywords(topRankKws);
      const byDate: Record<string, Record<string, number[]>> = {};
      for (const r of (rankRows || [])) {
        if (!topRankKws.includes(r.keyword)) continue;
        const d = r.created_at.slice(0, 10);
        if (!byDate[d]) byDate[d] = {};
        if (!byDate[d][r.keyword]) byDate[d][r.keyword] = [];
        byDate[d][r.keyword].push(r.rank);
      }
      const freshRankData: RankPoint[] = Object.entries(byDate)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([d, kws]) => {
          const pt: RankPoint = { date: d.slice(5) };
          for (const kw of topRankKws) { const ranks = kws[kw]; if (ranks?.length) pt[kw] = Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length * 10) / 10; }
          return pt;
        });
      setRankData(freshRankData);

      // AI suggestions
      const suggestions: Suggestion[] = [];
      for (const kw of freshTopKws) {
        if (kw.cpc >= 3000 && kw.clicks >= 3) {
          const comp = freshCompRows.find(c => c.keyword === kw.keyword);
          const sugBid = comp ? Math.round(comp.compBid * 1.05) : Math.round(kw.cpc * 0.8);
          suggestions.push({ id: `bid-${kw.keyword}`, type: 'bid', title: `${kw.keyword} CPC ${kw.cpc.toLocaleString()}원 → 입찰가 조정 제안`, description: `현재 CPC가 높습니다. 입찰가를 ${sugBid.toLocaleString()}원으로 조정하면 비용 절감이 가능합니다.`, status: 'pending' });
        }
        if (kw.conversions > 0 && kw.cpa > (account?.targetCpa || 50000)) {
          suggestions.push({ id: `cpa-${kw.keyword}`, type: 'budget', title: `${kw.keyword} CPA ${kw.cpa.toLocaleString()}원 — 목표 초과`, description: `목표 CPA(${(account?.targetCpa || 50000).toLocaleString()}원) 대비 높습니다. 입찰가를 낮추거나 소재를 개선하세요.`, status: 'pending' });
        }
      }
      if (suggestions.length === 0 && freshTopKws.length > 0) {
        suggestions.push({ id: 'ok', type: 'keyword', title: '현재 키워드 운영이 양호합니다', description: `CPC 평균 ${Math.round(freshTopKws.reduce((s, k) => s + k.cpc, 0) / freshTopKws.length).toLocaleString()}원, 전환 ${freshConversions}건. 현 전략 유지를 권장합니다.`, status: 'approved' });
      }
      setAiSuggestions(suggestions);

      if (cacheKey) {
        setCache(cacheKey, { periodStats: pRes, prevPeriodCost: freshPrevCost, dailyStats: freshDailyStats, topKeywords: freshTopKws, competitorRows: freshCompRows, bidLogs: recent, savingsMonth: savingSum, blockedCount: blockRes?.summary?.blocked || 0, conversions: freshConversions, rankData: freshRankData, rankKeywords: topRankKws } as DashboardSnapshot);
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, [adAccountId, account?.targetCampaignId, cacheKey, dates, applySnap, account?.targetCpa]);

  useEffect(() => {
    if (!adAccountId) return;
    fetchBizMoney().catch(() => {});
    loadDashboard();
    const id = setInterval(() => { fetchBizMoney().catch(() => {}); loadDashboard(); }, 3 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === 'visible') { fetchBizMoney().catch(() => {}); loadDashboard(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [adAccountId, fetchBizMoney, loadDashboard]);

  if (!adAccountId) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">히트AD</h3>
          <p className="text-sm text-gray-500">설정 탭에서 API 키를 연결하세요</p>
        </div>
      </div>
    );
  }

  const totalCost = periodStats.reduce((s, r) => s + (r.salesAmt || 0), 0);
  const totalClicks = periodStats.reduce((s, r) => s + (r.clkCnt || 0), 0);
  const cpc = totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0;
  const costDiff = totalCost - prevPeriodCost;
  const cpa = conversions > 0 ? Math.round(totalCost / conversions) : 0;

  const chartData = dailyStats.length > 0
    ? dailyStats.filter(r => r.statDt || r.date).map(r => {
        const raw = r.statDt || r.date || '';
        const parts = raw.split('-');
        return { date: parts.length >= 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : raw, spend: r.salesAmt || 0, clicks: r.clkCnt || 0, conversions: 0 };
      })
    : periodStats.filter(r => r.statDt || r.date).map(r => {
        const raw = r.statDt || r.date || '';
        return { date: raw.includes('-') ? raw.split('-').slice(1).map(Number).join('/') : raw, spend: r.salesAmt || 0, clicks: r.clkCnt || 0, conversions: 0 };
      });

  const kpis = [
    { label: '총 광고비', value: `${totalCost.toLocaleString()}원`, sub: prevPeriodCost > 0 ? `전기간 대비 ${costDiff > 0 ? '+' : ''}${costDiff.toLocaleString()}원` : '-', icon: <DollarSign className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
    { label: '평균 CPC', value: `${cpc.toLocaleString()}원`, sub: `클릭 ${totalClicks}회`, icon: <MousePointerClick className="w-5 h-5" />, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'CPA (예약당 비용)', value: conversions > 0 ? `${cpa.toLocaleString()}원` : '-', sub: `방문예약 ${conversions}건`, icon: <TrendingUp className="w-5 h-5" />, color: conversions > 0 ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-100' },
    { label: '부정클릭 절감', value: `${savingsMonth.toLocaleString()}원`, sub: `차단 ${blockedCount}건`, icon: <Shield className="w-5 h-5" />, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="h-full overflow-auto bg-gray-50 text-gray-900">
      <div className="p-5 space-y-5 max-w-[1600px] mx-auto">
        {/* 타이틀 + 기간 선택 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-bold text-gray-900">대시보드</h2>
            <HelpTooltip title="대시보드" auto="잔액·클릭수·CPC·소진액 3분마다 자동 갱신. 7일 트렌드 그래프 자동 생성." manual="매일 아침 확인. 잔액 부족 시 네이버에서 비즈머니 충전." />
            {refreshing && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400">
                <span className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" />
                <span className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
              {PERIOD_LABELS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p.key ? 'bg-[#093687] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-1">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-2 py-1 text-xs border border-gray-200 rounded-lg" />
                <span className="text-gray-400 text-xs">~</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-2 py-1 text-xs border border-gray-200 rounded-lg" />
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              잔액 <span className="font-bold text-emerald-700">{Math.floor(bizMoney).toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* 알람 배너 */}
        <div className="space-y-2">
          <AutoAdjustmentBanner adAccountId={adAccountId} />
          <ZeroImpressionAlert adAccountId={adAccountId} />
        </div>

        {/* KPI 4개 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(k => (
            <div key={k.label} className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2 ${k.color}`}>{k.icon}</div>
              <p className="text-[11px] font-medium text-gray-500">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 tracking-tight">{k.value}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* 성과 그래프 */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">성과 그래프</h3>
              <p className="text-[11px] text-gray-500">기간: {dates.start} ~ {dates.end}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showSpend} onChange={() => setShowSpend(!showSpend)} className="rounded" />
                <span className="text-blue-600">소진액</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showClicks} onChange={() => setShowClicks(!showClicks)} className="rounded" />
                <span className="text-amber-600">클릭</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={showConversions} onChange={() => setShowConversions(!showConversions)} className="rounded" />
                <span className="text-green-600">전환</span>
              </label>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
          </div>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} stroke="#d1d5db" />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6b7280' }} stroke="#d1d5db"
                    tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} stroke="#d1d5db" />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, n: string) => [n === 'spend' ? `${v.toLocaleString()}원` : `${v}`, n === 'spend' ? '소진액' : n === 'clicks' ? '클릭' : '전환']} />
                  {showSpend && <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#093687" strokeWidth={2} dot={false} />}
                  {showClicks && <Line yAxisId="right" type="monotone" dataKey="clicks" stroke="#F59E0B" strokeWidth={2} dot={false} />}
                  {showConversions && <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="5 5" />}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">{loading ? '조회 중...' : '데이터 없음'}</div>
            )}
          </div>
        </Card>

        {/* 키워드 순위 트렌드 (행=순위, 열=날짜) */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#093687]" />
              <h3 className="text-sm font-bold text-gray-900">
                키워드 순위 트렌드
                <span className="ml-2 text-xs text-gray-400 font-normal">날짜별 순위 · 소진액 · 클릭수 · CPC</span>
              </h3>
            </div>
            <select value={tableDays} onChange={e => setTableDays(+e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1">
              <option value={7}>7일</option>
              <option value={14}>14일</option>
              <option value={30}>30일</option>
            </select>
          </div>
          <KeywordDailyTable days={tableDays} />
        </Card>

        {/* 경쟁사 비교 + 자동입찰 인텔리전스 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 경쟁사 입찰가 비교 + AI 전략 제안 */}
          <Card>
            <div className="mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#093687]" />
                <h3 className="text-sm font-bold text-gray-900">경쟁사 입찰가 비교</h3>
              </div>
              {competitorRows.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">데이터 없음</p>
              ) : (
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[11px] text-gray-500 border-b border-gray-200">
                        <th className="text-left py-2 font-medium">키워드</th>
                        <th className="text-right py-2 font-medium">우리</th>
                        <th className="text-right py-2 font-medium">경쟁사</th>
                        <th className="text-right py-2 font-medium">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitorRows.map(r => (
                        <tr key={r.keyword} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 text-gray-800 truncate max-w-[160px]">{r.keyword}</td>
                          <td className="py-2 text-right text-gray-700">{r.ourBid.toLocaleString()}</td>
                          <td className="py-2 text-right text-gray-700">{r.compBid.toLocaleString()}</td>
                          <td className={`py-2 text-right font-bold ${r.delta > 0 ? 'text-emerald-600' : r.delta < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                            {r.delta > 0 ? '+' : ''}{r.delta}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AI 전략 제안 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  AI 전략 제안
                  <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-normal">Claude AI</span>
                </h3>
              </div>
              {aiSuggestions.length > 0 ? (
                <div className="space-y-2">
                  {aiSuggestions.map(s => (
                    <div key={s.id} className={`rounded-lg border p-3 ${s.status === 'approved' ? 'bg-green-50 border-green-200' : s.status === 'ignored' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-purple-50 border-purple-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900">{s.title}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5">{s.description}</p>
                        </div>
                        {s.status === 'pending' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setAiSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'approved' } : x))}
                              className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200" title="승인"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setAiSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'ignored' } : x))}
                              className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200" title="무시"><XIcon className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                        {s.status === 'approved' && <span className="text-[10px] text-green-700 font-bold shrink-0">승인됨</span>}
                        {s.status === 'ignored' && <span className="text-[10px] text-gray-500 shrink-0">무시됨</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-gray-400">
                  <div className="text-2xl mb-2">🤖</div>
                  <div>AI 브리핑 실행 시 전략 제안이 표시됩니다</div>
                </div>
              )}
            </div>
          </Card>

          {/* 자동입찰 인텔리전스 */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">자동입찰 인텔리전스</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">● ACTIVE</span>
            </div>
            <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-[11px] text-gray-600 mb-1">이번달 누적 절감액</p>
              <p className="text-2xl font-bold text-emerald-700">{savingsMonth.toLocaleString()} <span className="text-sm text-emerald-600">원</span></p>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-auto">
              {bidLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">최근 변경 없음</p>
              ) : bidLogs.map(log => {
                const down = log.to < log.from;
                const Icon = down ? ArrowDown : ArrowUp;
                const color = down ? 'text-emerald-600' : 'text-sky-600';
                return (
                  <div key={log.id} className="flex items-start gap-2 py-1.5 px-2 rounded bg-gray-50">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-gray-800 truncate">
                        <span className="font-medium">{log.keyword}</span>
                        <span className="text-gray-500"> · {log.from.toLocaleString()}→{log.to.toLocaleString()}원</span>
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">{log.reason}</p>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 py-1.5 px-2 rounded bg-blue-50 border border-blue-100">
                <RotateCw className="w-3 h-3 text-[#093687] animate-spin" style={{ animationDuration: '4s' }} />
                <span className="text-[10px] text-[#093687]">3분 주기 자동 실행 중</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl border border-gray-200 bg-white shadow-sm p-5 ${className}`}>{children}</div>;
}
