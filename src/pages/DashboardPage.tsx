import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Target, Sparkles, TrendingDown, Copy, Check,
  AlertTriangle, ArrowRight, Zap, X,
} from 'lucide-react';
import { workerFetch } from '@/lib/api';
import { getLimits } from '@/lib/plans';
import { supabase } from '@/lib/supabase';
import { usePlan } from '@/hooks/usePlan';
import { useSite } from '@/contexts/SiteContext';
import { Loader2 } from 'lucide-react';

interface StatsResponse {
  ips: { ip: string; count: number; events: { event: string; time: string }[] }[];
  summary: { total: number; totalClicks: number; blocked?: number };
}

interface BidLog {
  id: number;
  created_at: string;
  keyword: string;
  prev_bid: number;
  new_bid: number;
  current_rank: number | null;
  target_rank: number | null;
  strategy: string;
  reason?: string;
}

interface KeywordStat {
  keyword: string;
  current_rank: number | null;
  current_bid: number;
  target_rank: number | null;
}

interface NaverStatsResponse {
  totals?: { impCnt: number; clkCnt: number; salesAmt: number; crto: number };
  daily?: { date: string; impCnt: number; clkCnt: number; salesAmt: number }[];
}

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;

const won = (n: number) => `₩${(n ?? 0).toLocaleString()}`;
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

function monthRange() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { since: fmtDate(first), until: fmtDate(today) };
}

interface AiSuggestion {
  id: string;
  title: string;
  desc: string;
}

// 최근 7일 날짜 (오늘 포함, 역순)
function getLast7Days(): { label: string; iso: string }[] {
  const days: { label: string; iso: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      iso: fmtDate(d),
    });
  }
  return days;
}

export function DashboardPage() {
  const { siteId, selected } = useSite();
  const { plan } = usePlan();
  const SCRIPT_TAG = `<script src="${WORKER_URL}/collect?site_id=${siteId || 'YOUR_SITE_ID'}" async></script>`;
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [bidLogs, setBidLogs] = useState<BidLog[]>([]);
  const [keywords, setKeywords] = useState<KeywordStat[]>([]);
  const [naverStats, setNaverStats] = useState<NaverStatsResponse | null>(null);
  const [aiUsage, setAiUsage] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dismissedSugs, setDismissedSugs] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    const month = monthRange();
    Promise.allSettled([
      workerFetch<StatsResponse>(`/stats?site_id=${siteId}`),
      workerFetch<{ logs?: BidLog[] } | BidLog[]>(`/naver/bid-logs?site_id=${siteId}&limit=100`),
      workerFetch<{ keywords?: KeywordStat[] } | KeywordStat[]>(`/naver/keyword-stats?site_id=${siteId}`),
      workerFetch<NaverStatsResponse>('/naver/stats', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          ids: [],
          timeRange: month,
          fields: ['clkCnt', 'impCnt', 'salesAmt', 'crto'],
          idType: 'campaign',
          timeUnit: 'day',
        }),
      }),
      supabase.auth.getUser(),
    ]).then(([statsR, logsR, kwR, nstatR, userR]) => {
      if (statsR.status === 'fulfilled') setStats(statsR.value);
      if (logsR.status === 'fulfilled') {
        const v = logsR.value;
        setBidLogs(Array.isArray(v) ? v : v?.logs ?? []);
      }
      if (kwR.status === 'fulfilled') {
        const v = kwR.value;
        setKeywords(Array.isArray(v) ? v : v?.keywords ?? []);
      }
      if (nstatR.status === 'fulfilled') setNaverStats(nstatR.value);
      if (userR.status === 'fulfilled') {
        const meta = (userR.value.data?.user?.user_metadata ?? {}) as Record<string, unknown>;
        setAiUsage(Number(meta.ai_usage_count ?? 0));
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // AI 전략 제안 - keyword_stats 상위 10개 기반 (3초 지연으로 KPI 먼저 표시)
  useEffect(() => {
    if (!siteId || keywords.length === 0) return;
    setAiLoading(true);
    const timer = setTimeout(() => {
      workerFetch<{ data?: { suggestions?: AiSuggestion[]; actions?: { text: string; level: string }[] } }>(
        '/ai',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'briefing',
            data: {
              keywords: keywords.slice(0, 10).map((k) => ({
                keyword: k.keyword,
                current_rank: k.current_rank,
                current_bid: k.current_bid,
                target_rank: k.target_rank,
              })),
            },
          }),
        },
      )
        .then((res) => {
          const sugList = res?.data?.suggestions ?? [];
          if (sugList.length > 0) {
            setAiSuggestions(sugList);
          } else if (res?.data?.actions) {
            setAiSuggestions(
              res.data.actions.slice(0, 3).map((a, i) => ({
                id: `ai-${i}`,
                title: a.text,
                desc: '',
              })),
            );
          }
        })
        .catch(() => setAiSuggestions([]))
        .finally(() => setAiLoading(false));
    }, 2000);
    return () => clearTimeout(timer);
  }, [siteId, keywords]);

  const totals = naverStats?.totals ?? { impCnt: 0, clkCnt: 0, salesAmt: 0, crto: 0 };
  const avgCpc = totals.clkCnt > 0 ? Math.round(totals.salesAmt / totals.clkCnt) : 0;

  const blockedToday = useMemo(() => {
    if (!stats?.ips) return 0;
    return stats.ips.filter((ip) => ip.count >= 5).length;
  }, [stats]);
  const blockSavings = blockedToday * (avgCpc || 0);

  const targetHit = useMemo(() => {
    if (keywords.length === 0) return { rate: 0, achieved: 0 };
    const achieved = keywords.filter(
      (k) => k.target_rank != null && k.current_rank === k.target_rank,
    ).length;
    return { rate: Math.round((achieved / keywords.length) * 100), achieved };
  }, [keywords]);

  const inefficientCount = useMemo(
    () => keywords.filter((k) => k.current_rank == null).length,
    [keywords],
  );
  const inefficientWaste = inefficientCount * (avgCpc || 0) * 30;

  const monthSavings = useMemo(() => {
    const monthStart = monthRange().since;
    const inMonth = bidLogs.filter((l) => (l.created_at ?? '').slice(0, 10) >= monthStart);
    let saved = 0;
    for (const l of inMonth) {
      const d = (l.new_bid ?? 0) - (l.prev_bid ?? 0);
      if (d < 0) saved += -d;
    }
    return saved;
  }, [bidLogs]);

  const totalSavings = monthSavings + blockSavings;

  const aiLimit = getLimits(plan).aiAnalysisPerMonth;
  const aiLimitLabel = aiLimit === Infinity ? '∞' : aiLimit;

  const recentBidAdjustments = useMemo(() => {
    return bidLogs.slice(0, 3).map((l) => {
      const delta = (l.new_bid ?? 0) - (l.prev_bid ?? 0);
      const pct = l.prev_bid > 0 ? Math.round((delta / l.prev_bid) * 100) : 0;
      return {
        keyword: l.keyword,
        from: l.prev_bid,
        to: l.new_bid,
        reason: `${l.current_rank ?? '-'}위→${l.target_rank ?? '-'}위`,
        delta: pct,
      };
    });
  }, [bidLogs]);

  const kpiCards = [
    {
      label: '부정클릭 차단',
      icon: ShieldCheck,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      value: `${blockedToday}건`,
      sub: `절감 ${won(blockSavings)}`,
    },
    {
      label: '자동입찰 적중률',
      icon: Target,
      color: 'text-green-600',
      bg: 'bg-green-50',
      value: keywords.length > 0 ? `${targetHit.rate}%` : '- %',
      sub: `키워드 ${keywords.length}개 · 달성 ${targetHit.achieved}`,
    },
    {
      label: 'AI 분석 사용',
      icon: Sparkles,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      value: `${aiUsage}/${aiLimitLabel}회`,
      sub: `${plan.toUpperCase()} 플랜`,
    },
    {
      label: '이번달 절감액',
      icon: TrendingDown,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      value: won(totalSavings),
      sub: '자동입찰 + 차단',
    },
  ];

  const recentClicks: { ip: string; time: string; keyword: string; status: string }[] = [];
  if (stats?.ips) {
    for (const ipRow of stats.ips) {
      for (const ev of ipRow.events.slice(-10)) {
        recentClicks.push({
          ip: ipRow.ip,
          time: new Date(ev.time).toLocaleString('ko-KR'),
          keyword: '-',
          status: ipRow.count >= 5 ? '의심' : '정상',
        });
      }
    }
    recentClicks.reverse();
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(SCRIPT_TAG);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const last7Days = getLast7Days();
  const visibleSugs = aiSuggestions.filter(s => !dismissedSugs.includes(s.id));

  // 키워드 순위 트렌드: 오늘은 keyword_stats, 과거는 bid_logs 날짜별 마지막 current_rank
  const rankTrend = useMemo(() => {
    const todayIso = fmtDate(new Date());
    // 오늘 = keyword_stats current_rank 기준 정렬
    const todayMap = new Map<string, number | null>();
    for (const k of keywords) todayMap.set(k.keyword, k.current_rank);
    const sorted = [...keywords]
      .filter((k) => k.current_rank != null)
      .sort((a, b) => (a.current_rank ?? 999) - (b.current_rank ?? 999))
      .slice(0, 10);
    // 과거 6일: bid_logs에서 date+keyword별 마지막 current_rank
    const historyByDate = new Map<string, Map<string, number | null>>();
    for (const log of bidLogs) {
      const d = (log.created_at ?? '').slice(0, 10);
      if (!d || d === todayIso) continue;
      if (!historyByDate.has(d)) historyByDate.set(d, new Map());
      historyByDate.get(d)!.set(log.keyword, log.current_rank);
    }
    return sorted.map((k) => {
      const cells = last7Days.map((day) => {
        if (day.iso === todayIso) return todayMap.get(k.keyword) ?? null;
        return historyByDate.get(day.iso)?.get(k.keyword) ?? null;
      });
      return { keyword: k.keyword, currentRank: k.current_rank ?? 0, cells };
    });
  }, [keywords, bidLogs, last7Days]);

  // 빠른 설정 체크리스트 (실데이터)
  const checklist = useMemo(
    () => [
      { label: '사이트 등록', done: !!siteId },
      { label: '스크립트 설치', done: !!selected?.script_installed },
      { label: '네이버 계정 연결', done: !!selected?.naver_customer_id },
      { label: '첫 입찰 설정', done: bidLogs.length > 0 },
    ],
    [siteId, selected, bidLogs],
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, icon: Icon, color, bg, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* 비효율 키워드 경고 배너 */}
      {inefficientCount > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-red-900 text-base">
                🔴 비효율 키워드 {inefficientCount}개 감지
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                노출 0회 · 예상 낭비 광고비 월 {won(inefficientWaste)}
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/autobid"
            className="flex items-center gap-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shrink-0 transition-colors"
          >
            지금 최적화
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 클릭 로그 + 키워드 순위 트렌드 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 클릭 로그 */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">최근 클릭 로그</h3>
              <span className="text-xs text-gray-400">
                {stats ? `${stats.summary.totalClicks}건 수집됨` : '로딩 중...'}
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">로딩 중...</div>
            ) : recentClicks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-5 py-3 font-medium">IP</th>
                      <th className="px-5 py-3 font-medium">시간</th>
                      <th className="px-5 py-3 font-medium">키워드</th>
                      <th className="px-5 py-3 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentClicks.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-gray-700">{row.ip}</td>
                        <td className="px-5 py-3 text-gray-500">{row.time}</td>
                        <td className="px-5 py-3 text-gray-500">{row.keyword}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            row.status === '의심' ? 'bg-red-50 text-red-600' :
                            row.status === '차단' ? 'bg-gray-100 text-gray-600' :
                            'bg-green-50 text-green-600'
                          }`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500 mb-4">아직 수집된 클릭이 없습니다</p>
                <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
                  <p className="text-xs font-medium text-gray-700 mb-2">아래 스크립트를 사이트에 설치하세요:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-gray-100 p-2 rounded flex-1 overflow-x-auto text-gray-600">{SCRIPT_TAG}</code>
                    <button onClick={handleCopy} className="p-2 rounded hover:bg-gray-200 text-gray-500 shrink-0">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 키워드 순위 트렌드 */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">키워드 순위 트렌드</h3>
              <span className="text-xs text-gray-400">최근 7일</span>
            </div>
            {rankTrend.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                {loading ? '불러오는 중...' : '키워드 데이터가 없습니다'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-2 font-medium w-12">순위</th>
                      <th className="px-4 py-2 font-medium">키워드</th>
                      {last7Days.map((d) => (
                        <th key={d.iso} className="px-2 py-2 font-medium text-center w-12">{d.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rankTrend.map((row) => (
                      <tr key={row.keyword} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            row.currentRank <= 3 ? 'bg-blue-100 text-blue-700' :
                            row.currentRank <= 7 ? 'bg-gray-100 text-gray-700' :
                            'bg-gray-50 text-gray-400'
                          }`}>{row.currentRank}위</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700 truncate max-w-[200px]">{row.keyword}</td>
                        {row.cells.map((rank, i) => (
                          <td key={i} className="px-2 py-2.5 text-center">
                            {rank == null ? (
                              <span className="text-gray-300 text-[10px]">-</span>
                            ) : (
                              <div className={`w-1.5 h-1.5 rounded-full mx-auto ${
                                rank <= 3 ? 'bg-blue-500' :
                                rank <= 7 ? 'bg-gray-400' :
                                'bg-gray-200'
                              }`} />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* 자동입찰 인텔리전스 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-gray-900 text-sm">자동입찰 인텔리전스</h3>
              </div>
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ACTIVE</span>
            </div>
            <div className="px-5 py-4 bg-gradient-to-br from-blue-50 to-violet-50">
              <p className="text-xs text-gray-500">이번달 누적 절감액</p>
              <p className="text-2xl font-bold text-blue-700">{won(monthSavings)}</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-xs font-medium text-gray-500 mb-2">최근 조정 내역</p>
              {recentBidAdjustments.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">조정 내역이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {recentBidAdjustments.map((adj, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{adj.keyword}</p>
                        <p className="text-gray-400 mt-0.5">
                          {adj.from}→{adj.to}원 · {adj.reason}
                        </p>
                      </div>
                      <span
                        className={`font-semibold ml-2 shrink-0 ${
                          adj.delta < 0 ? 'text-green-600' : adj.delta > 0 ? 'text-red-600' : 'text-gray-500'
                        }`}
                      >
                        {adj.delta > 0 ? '+' : ''}
                        {adj.delta}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI 전략 제안 */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <h3 className="font-semibold text-gray-900 text-sm">AI 전략 제안</h3>
              </div>
              <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Claude AI</span>
            </div>
            <div className="p-3 space-y-2">
              {aiLoading ? (
                <div className="py-6 text-center">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500 mx-auto" />
                </div>
              ) : visibleSugs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">제안 없음</p>
              ) : visibleSugs.map((sug) => (
                <div key={sug.id} className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-900 leading-snug flex-1">{sug.title}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="w-5 h-5 rounded bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center" title="적용">
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDismissedSugs(prev => [...prev, sug.id])}
                        className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center"
                        title="무시"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">{sug.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">빠른 설정</h3>
            <div className="space-y-3">
              {checklist.map(({ label, done }) => (
                <label key={label} className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    done ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {done && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
