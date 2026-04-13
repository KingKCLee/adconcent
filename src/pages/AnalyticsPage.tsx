import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, Lightbulb, CheckCircle2, FileText, TrendingUp, Wallet } from 'lucide-react';
import { workerFetch } from '@/lib/api';
import { getLimits } from '@/lib/plans';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';
import { usePlan } from '@/hooks/usePlan';
import { useSite } from '@/contexts/SiteContext';

type Tab = 'briefing' | 'keyword' | 'ad' | 'weekly' | 'report' | 'expansion' | 'budget';

interface BriefingResult {
  summary: string;
  details: string[];
  actions: { text: string; level: 'urgent' | 'warn' | 'info'; tab?: string }[];
}
interface KeywordResult { icon: string; message: string; color: string; action?: string }
interface AdResult { headlines: string[]; descriptions: string[]; reasoning: string }
interface WeeklyResult { good: string[]; improve: string[]; recommend: string[] }
interface WeeklyReportResult {
  period?: string;
  summary: string;
  highlights?: string[];
  recommendations?: { title: string; desc: string; priority?: string }[];
}
interface KeywordExpansionItem {
  keyword: string;
  monthly_search?: number;
  competition?: string;
  reason?: string;
}
interface BudgetItem {
  keyword: string;
  current_bid?: number;
  recommended_bid: number;
  reason?: string;
}
interface BudgetOptimizerResult {
  total_budget: number;
  expected_clicks?: number;
  recommendations: BudgetItem[];
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'briefing', label: '오늘 브리핑' },
  { key: 'keyword', label: '키워드 진단' },
  { key: 'ad', label: '광고소재 추천' },
  { key: 'weekly', label: '주간 비교' },
  { key: 'report', label: '주간 리포트' },
  { key: 'expansion', label: '키워드 추천' },
  { key: 'budget', label: '예산 최적화' },
];

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function thisWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const since = new Date(today);
  since.setDate(today.getDate() - day);
  return { since: fmtDate(since), until: fmtDate(today) };
}

async function callAi<T>(action: string, data: Record<string, unknown>): Promise<T | null> {
  const res = await workerFetch<{ data: T }>('/ai', {
    method: 'POST',
    body: JSON.stringify({ action, data }),
  });
  return res.data;
}

export function AnalyticsPage() {
  const { plan } = usePlan();
  const { siteId } = useSite();
  const FREE_QUOTA = getLimits(plan).aiAnalysisPerMonth;
  const QUOTA_LABEL = FREE_QUOTA === Infinity ? '∞' : FREE_QUOTA;
  const [tab, setTab] = useState<Tab>('briefing');
  const [usage, setUsage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [briefing, setBriefing] = useState<BriefingResult | null>(null);
  const [keyword, setKeyword] = useState('');
  const [keywordResult, setKeywordResult] = useState<KeywordResult | null>(null);
  const [productName, setProductName] = useState('');
  const [region, setRegion] = useState('');
  const [adKeywords, setAdKeywords] = useState('');
  const [adResult, setAdResult] = useState<AdResult | null>(null);
  const [weekly, setWeekly] = useState<WeeklyResult | null>(null);

  // Weekly report
  const initRange = thisWeekRange();
  const [reportSince, setReportSince] = useState(initRange.since);
  const [reportUntil, setReportUntil] = useState(initRange.until);
  const [reportResult, setReportResult] = useState<WeeklyReportResult | null>(null);

  // Keyword expansion
  const [seedKeywords, setSeedKeywords] = useState('');
  const [expansionResult, setExpansionResult] = useState<KeywordExpansionItem[]>([]);

  // Budget optimizer
  const [monthlyBudget, setMonthlyBudget] = useState<number>(1000000);
  const [budgetResult, setBudgetResult] = useState<BudgetOptimizerResult | null>(null);

  // Saved analysis results (sessionStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('adconcent.analytics');
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (cached.briefing) setBriefing(cached.briefing);
      if (cached.reportResult) setReportResult(cached.reportResult);
      if (cached.expansionResult) setExpansionResult(cached.expansionResult);
      if (cached.budgetResult) setBudgetResult(cached.budgetResult);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const persistAnalytics = (patch: Record<string, any>) => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('adconcent.analytics');
      const cur = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem('adconcent.analytics', JSON.stringify({ ...cur, ...patch }));
    } catch {}
  };

  // 실데이터 컨텍스트 (마운트 시 미리 로드)
  const [siteContext, setSiteContext] = useState<{
    totals: { impressions: number; clicks: number; cost: number; conversions: number };
    topKeywords: any[];
    weekTotals?: { imp: number; clk: number; cost: number; conv: number };
    lastWeekTotals?: { imp: number; clk: number; cost: number; conv: number };
  }>({
    totals: { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
    topKeywords: [],
  });

  useEffect(() => {
    if (!siteId) return;
    const today = new Date();
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
    const monthFirst = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

    Promise.allSettled([
      workerFetch<any>('/naver/stats', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          ids: [],
          timeRange: { since: fmtDate(monthFirst), until: fmtDate(today) },
          fields: ['clkCnt', 'impCnt', 'salesAmt', 'crto'],
          idType: 'campaign',
          timeUnit: 'day',
        }),
      }),
      workerFetch<any>(`/naver/keyword-stats?site_id=${siteId}&offset=0&limit=20`),
      workerFetch<any>('/naver/stats', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          ids: [],
          timeRange: { since: fmtDate(thisWeekStart), until: fmtDate(today) },
          fields: ['clkCnt', 'impCnt', 'salesAmt', 'crto'],
          idType: 'campaign',
          timeUnit: 'day',
        }),
      }),
      workerFetch<any>('/naver/stats', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          ids: [],
          timeRange: { since: fmtDate(lastWeekStart), until: fmtDate(lastWeekEnd) },
          fields: ['clkCnt', 'impCnt', 'salesAmt', 'crto'],
          idType: 'campaign',
          timeUnit: 'day',
        }),
      }),
    ]).then(([monthR, kwR, thisWeekR, lastWeekR]) => {
      const next: any = {
        totals: { impressions: 0, clicks: 0, cost: 0, conversions: 0 },
        topKeywords: [],
      };
      if (monthR.status === 'fulfilled' && monthR.value?.totals) {
        const t = monthR.value.totals;
        next.totals = {
          impressions: t.impCnt ?? 0,
          clicks: t.clkCnt ?? 0,
          cost: t.salesAmt ?? 0,
          conversions: Math.round(t.crto ?? 0),
        };
      }
      if (kwR.status === 'fulfilled') {
        const v = kwR.value;
        next.topKeywords = Array.isArray(v) ? v : v?.data ?? v?.keywords ?? [];
      }
      if (thisWeekR.status === 'fulfilled' && thisWeekR.value?.totals) {
        const t = thisWeekR.value.totals;
        next.weekTotals = { imp: t.impCnt ?? 0, clk: t.clkCnt ?? 0, cost: t.salesAmt ?? 0, conv: Math.round(t.crto ?? 0) };
      }
      if (lastWeekR.status === 'fulfilled' && lastWeekR.value?.totals) {
        const t = lastWeekR.value.totals;
        next.lastWeekTotals = { imp: t.impCnt ?? 0, clk: t.clkCnt ?? 0, cost: t.salesAmt ?? 0, conv: Math.round(t.crto ?? 0) };
      }
      setSiteContext(next);
    });
  }, [siteId]);

  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const handleAddToAutobid = async (keyword: string) => {
    if (!siteId) {
      setError('사이트가 선택되지 않았습니다');
      return;
    }
    try {
      await workerFetch('/naver/bid-settings', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          keyword,
          keyword_id: `manual_${keyword}`,
          target_rank: 3,
          max_bid: 3000,
          min_bid: 70,
          strategy: 'target_rank',
          is_active: 1,
        }),
      });
      setAddedKeywords((prev) => new Set(prev).add(keyword));
    } catch (e: any) {
      setError(`추가 실패: ${e?.message ?? ''}`);
    }
  };

  const run = async (fn: () => Promise<void>) => {
    if (usage >= FREE_QUOTA) { setShowUpgrade(true); return; }
    setLoading(true); setError('');
    try {
      await fn();
      setUsage(u => u + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBriefing = () => run(async () => {
    const result = await callAi<BriefingResult>('briefing', {
      site_id: siteId,
      totals: siteContext.totals,
      topKeywords: siteContext.topKeywords.slice(0, 10),
    });
    setBriefing(result);
    persistAnalytics({ briefing: result });
  });

  const handleKeyword = () => run(async () => {
    if (!keyword) { setError('키워드를 입력하세요'); return; }
    // 입력된 키워드와 매칭되는 실데이터 찾기
    const matched = siteContext.topKeywords.find((k: any) =>
      k.keyword === keyword || k.keyword?.toLowerCase().includes(keyword.toLowerCase()),
    );
    const result = await callAi<KeywordResult>('keyword_health', {
      site_id: siteId,
      keyword,
      bidAmt: matched?.current_bid ?? 0,
      qiGrade: matched?.qi_grade ?? null,
      rank1Bid: matched?.bid_rank1 ?? null,
      rank3Bid: matched?.bid_rank3 ?? null,
      status: matched?.ad_status ?? 'ELIGIBLE',
      impressions: matched?.monthly_pc ?? 0,
      clicks: matched?.clkCnt ?? 0,
    });
    setKeywordResult(result);
  });

  const handleAd = () => run(async () => {
    if (!productName) { setError('상품명을 입력하세요'); return; }
    // 운영 중인 상위 키워드 자동 첨부
    const topKeywordList = siteContext.topKeywords
      .slice(0, 5)
      .map((k: any) => k.keyword)
      .filter(Boolean);
    const userKeywords = adKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    const result = await callAi<AdResult>('ad_suggestions', {
      site_id: siteId,
      productName,
      region,
      keywords: userKeywords.length > 0 ? userKeywords : topKeywordList,
    });
    setAdResult(result);
  });

  const handleWeekly = () => run(async () => {
    const result = await callAi<WeeklyResult>('weekly_insight', {
      site_id: siteId,
      thisWeek: siteContext.weekTotals ?? { imp: 0, clk: 0, cost: 0, conv: 0 },
      lastWeek: siteContext.lastWeekTotals ?? { imp: 0, clk: 0, cost: 0, conv: 0 },
    });
    setWeekly(result);
  });

  const handleWeeklyReport = () => run(async () => {
    const result = await callAi<WeeklyReportResult>('weekly_report', {
      site_id: siteId,
      since: reportSince,
      until: reportUntil,
    });
    setReportResult(result);
    persistAnalytics({ reportResult: result });
  });

  const handleKeywordExpansion = () => run(async () => {
    const seeds = seedKeywords
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (seeds.length === 0) {
      setError('시드 키워드를 1개 이상 입력하세요');
      return;
    }
    const result = await callAi<{ keywords?: KeywordExpansionItem[] } | KeywordExpansionItem[]>(
      'keyword_expansion',
      { site_id: siteId, seed_keywords: seeds },
    );
    const list = Array.isArray(result) ? result : result?.keywords ?? [];
    setExpansionResult(list);
    persistAnalytics({ expansionResult: list });
  });

  const handleBudgetOptimizer = () => run(async () => {
    if (!monthlyBudget || monthlyBudget <= 0) {
      setError('월 예산을 입력하세요');
      return;
    }
    const result = await callAi<BudgetOptimizerResult>('budget_optimizer', {
      site_id: siteId,
      monthly_budget: monthlyBudget,
    });
    setBudgetResult(result);
    persistAnalytics({ budgetResult: result });
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-1.5 flex gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-violet-50 text-violet-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Quota */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span className="text-sm text-gray-600">AI 분석 사용량</span>
        </div>
        <span className="text-sm font-medium">
          <span className="text-violet-600">{usage}</span>
          <span className="text-gray-400"> / {QUOTA_LABEL}회 ({plan.toUpperCase()} 플랜)</span>
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Briefing */}
      {tab === 'briefing' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {!briefing && !loading && (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-violet-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">오늘의 광고 성과를 AI가 분석합니다</h3>
              <p className="text-sm text-gray-500 mb-2">노출, 클릭, 전환, CPA를 종합하여 액션을 제안합니다.</p>
              {usage >= FREE_QUOTA && (
                <p className="text-xs text-amber-600 font-medium mb-4">이번달 사용 완료 ({usage}/{QUOTA_LABEL}회)</p>
              )}
              <button
                onClick={handleBriefing}
                disabled={usage >= FREE_QUOTA}
                className="px-6 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                AI 분석 시작
              </button>
            </div>
          )}
          {loading && <div className="py-12 text-center"><Loader2 className="w-8 h-8 text-violet-600 mx-auto animate-spin" /><p className="text-sm text-gray-500 mt-3">AI 분석 중...</p></div>}
          {briefing && !loading && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-lg p-5 border border-violet-200">
                <p className="text-base font-semibold text-gray-900">{briefing.summary}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">상세 분석</h4>
                <ul className="space-y-2">
                  {briefing.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-violet-500 mt-1">•</span><span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">추천 액션</h4>
                <div className="space-y-2">
                  {briefing.actions.map((a, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
                      a.level === 'urgent' ? 'bg-red-50 border-red-200' :
                      a.level === 'warn' ? 'bg-amber-50 border-amber-200' :
                      'bg-blue-50 border-blue-200'
                    }`}>
                      <span>{a.level === 'urgent' ? '🔴' : a.level === 'warn' ? '🟡' : '🟢'}</span>
                      <span className="text-sm text-gray-700 flex-1">{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={handleBriefing} className="text-sm text-violet-600 hover:underline">다시 분석</button>
            </div>
          )}
        </div>
      )}

      {/* Keyword */}
      {tab === 'keyword' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex gap-2 mb-4">
            <input
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
              placeholder="진단할 키워드 입력 (예: 송도분양)"
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button onClick={handleKeyword} disabled={loading} className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              진단
            </button>
          </div>
          {loading && <Loader2 className="w-6 h-6 text-violet-600 animate-spin mx-auto" />}
          {keywordResult && !loading && (
            <div className="bg-violet-50 rounded-lg p-5 border border-violet-200">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{keywordResult.icon}</span>
                <p className={`font-semibold ${keywordResult.color}`}>{keywordResult.message}</p>
              </div>
              {keywordResult.action && <p className="text-sm text-gray-600">권장: {keywordResult.action}</p>}
            </div>
          )}
        </div>
      )}

      {/* Ad suggestions */}
      {tab === 'ad' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-3 mb-4">
            <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="상품명/프로젝트명"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="지역 (예: 송도)"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <input value={adKeywords} onChange={(e) => setAdKeywords(e.target.value)} placeholder="키워드 (콤마 구분)"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <button onClick={handleAd} disabled={loading} className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
              소재 추천
            </button>
          </div>
          {loading && <Loader2 className="w-6 h-6 text-violet-600 animate-spin mx-auto" />}
          {adResult && !loading && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">제목 추천</h4>
                <ul className="space-y-1.5">
                  {adResult.headlines.map((h, i) => <li key={i} className="text-sm bg-gray-50 px-3 py-2 rounded">{h}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">설명 추천</h4>
                <ul className="space-y-1.5">
                  {adResult.descriptions.map((d, i) => <li key={i} className="text-sm bg-gray-50 px-3 py-2 rounded">{d}</li>)}
                </ul>
              </div>
              <p className="text-xs text-gray-500 italic">💡 {adResult.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* Weekly */}
      {tab === 'weekly' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {!weekly && !loading && (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-violet-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">이번주 vs 지난주 성과 비교</h3>
              <button onClick={handleWeekly} className="px-6 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700">
                주간 비교 분석
              </button>
            </div>
          )}
          {loading && <Loader2 className="w-8 h-8 text-violet-600 mx-auto animate-spin" />}
          {weekly && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />잘 된 점</h4>
                <ul className="space-y-1.5 text-sm text-gray-700">{weekly.good.map((g, i) => <li key={i}>• {g}</li>)}</ul>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-1"><AlertCircle className="w-4 h-4" />개선 필요</h4>
                <ul className="space-y-1.5 text-sm text-gray-700">{weekly.improve.map((g, i) => <li key={i}>• {g}</li>)}</ul>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-1"><Lightbulb className="w-4 h-4" />추천 조치</h4>
                <ul className="space-y-1.5 text-sm text-gray-700">{weekly.recommend.map((g, i) => <li key={i}>• {g}</li>)}</ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weekly Report */}
      {tab === 'report' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI 주간 리포트</h3>
          </div>
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <input
              type="date"
              value={reportSince}
              onChange={(e) => setReportSince(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={reportUntil}
              onChange={(e) => setReportUntil(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={handleWeeklyReport}
              disabled={loading}
              className="ml-auto px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              리포트 생성
            </button>
          </div>
          {loading && (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-violet-600 mx-auto animate-spin" />
              <p className="text-sm text-gray-500 mt-3">AI가 분석 중입니다...</p>
            </div>
          )}
          {reportResult && !loading && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-lg p-5 border border-violet-200">
                {reportResult.period && (
                  <p className="text-xs text-violet-700 font-medium mb-2">{reportResult.period}</p>
                )}
                <p className="text-base text-gray-900 leading-relaxed whitespace-pre-line">{reportResult.summary}</p>
              </div>
              {reportResult.highlights && reportResult.highlights.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">하이라이트</h4>
                  <div className="flex flex-wrap gap-2">
                    {reportResult.highlights.map((h, i) => (
                      <span key={i} className="text-xs px-3 py-1.5 bg-violet-50 text-violet-700 rounded-full border border-violet-200">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {reportResult.recommendations && reportResult.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">추천 액션</h4>
                  <div className="space-y-2">
                    {reportResult.recommendations.map((r, i) => {
                      const tone =
                        r.priority === 'high' ? 'bg-red-50 border-red-200' :
                        r.priority === 'medium' ? 'bg-amber-50 border-amber-200' :
                        'bg-blue-50 border-blue-200';
                      return (
                        <div key={i} className={`p-4 rounded-lg border ${tone}`}>
                          <p className="text-sm font-semibold text-gray-900 mb-1">{r.title}</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{r.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {!reportResult && !loading && (
            <p className="text-sm text-gray-400 text-center py-8">기간을 선택하고 [리포트 생성]을 눌러주세요</p>
          )}
        </div>
      )}

      {/* Keyword Expansion */}
      {tab === 'expansion' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI 키워드 추천</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            현재 운영 중인 시드 키워드를 입력하면 확장 가능한 추천 키워드를 제안합니다.
          </p>
          <textarea
            value={seedKeywords}
            onChange={(e) => setSeedKeywords(e.target.value)}
            rows={3}
            placeholder="시드 키워드 (콤마 또는 줄바꿈으로 구분)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3"
          />
          <button
            onClick={handleKeywordExpansion}
            disabled={loading}
            className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            추천 받기
          </button>
          {loading && (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 text-violet-600 mx-auto animate-spin" />
            </div>
          )}
          {expansionResult.length > 0 && !loading && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-medium">키워드</th>
                    <th className="px-3 py-3 font-medium text-right">월 검색량</th>
                    <th className="px-3 py-3 font-medium text-center">경쟁도</th>
                    <th className="px-3 py-3 font-medium">추천 이유</th>
                    <th className="px-3 py-3 font-medium text-center">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {expansionResult.map((k, i) => {
                    const added = addedKeywords.has(k.keyword);
                    return (
                      <tr key={`${k.keyword}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{k.keyword}</td>
                        <td className="px-3 py-3 text-right text-gray-700">
                          {k.monthly_search ? k.monthly_search.toLocaleString() : '-'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {k.competition ? (
                            <span
                              className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                                k.competition === 'high' ? 'bg-red-50 text-red-600' :
                                k.competition === 'medium' ? 'bg-amber-50 text-amber-600' :
                                'bg-green-50 text-green-600'
                              }`}
                            >
                              {k.competition === 'high' ? '높음' : k.competition === 'medium' ? '중간' : '낮음'}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">{k.reason ?? '-'}</td>
                        <td className="px-3 py-3 text-center">
                          {added ? (
                            <span className="text-[10px] text-green-600 font-medium flex items-center gap-1 justify-center">
                              <CheckCircle2 className="w-3 h-3" /> 추가됨
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddToAutobid(k.keyword)}
                              className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              + 자동입찰
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Budget Optimizer */}
      {tab === 'budget' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI 예산 최적화</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            월 예산을 기준으로 키워드별 추천 입찰가를 계산합니다.
          </p>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(Number(e.target.value))}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="월 예산 (원)"
            />
            <span className="text-sm text-gray-500">원/월</span>
            <button
              onClick={handleBudgetOptimizer}
              disabled={loading}
              className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              최적화 분석
            </button>
          </div>
          {loading && (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 text-violet-600 mx-auto animate-spin" />
            </div>
          )}
          {budgetResult && !loading && (
            <div className="mt-5 space-y-4">
              <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-lg p-4 border border-violet-200 flex items-center gap-6">
                <div>
                  <p className="text-xs text-gray-500">총 예산</p>
                  <p className="text-lg font-bold text-gray-900">₩{budgetResult.total_budget.toLocaleString()}</p>
                </div>
                {budgetResult.expected_clicks != null && (
                  <div>
                    <p className="text-xs text-gray-500">예상 클릭</p>
                    <p className="text-lg font-bold text-gray-900">{budgetResult.expected_clicks.toLocaleString()}회</p>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 font-medium">키워드</th>
                      <th className="px-3 py-3 font-medium text-right">현재 입찰가</th>
                      <th className="px-3 py-3 font-medium text-right">추천 입찰가</th>
                      <th className="px-3 py-3 font-medium">사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetResult.recommendations.map((r, i) => {
                      const delta = r.current_bid != null ? r.recommended_bid - r.current_bid : 0;
                      return (
                        <tr key={`${r.keyword}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{r.keyword}</td>
                          <td className="px-3 py-3 text-right text-gray-700">
                            {r.current_bid != null ? `₩${r.current_bid.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-900 font-semibold">
                            ₩{r.recommended_bid.toLocaleString()}
                            {delta !== 0 && (
                              <span
                                className={`block text-[10px] font-medium ${
                                  delta < 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {delta > 0 ? '+' : ''}
                                {delta.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">{r.reason ?? '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showUpgrade && (
        <UpgradePrompt
          feature="AI 분석"
          description={`현재 ${plan.toUpperCase()} 플랜은 월 ${QUOTA_LABEL}회만 AI 분석이 가능합니다. 상위 플랜으로 업그레이드하세요.`}
          usage={`이번달 ${usage}/${QUOTA_LABEL}회 사용 완료`}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}
