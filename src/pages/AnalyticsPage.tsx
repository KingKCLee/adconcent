import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Lightbulb, CheckCircle2 } from 'lucide-react';
import { workerFetch } from '@/lib/api';
import { getLimits } from '@/lib/plans';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';

type Tab = 'briefing' | 'keyword' | 'ad' | 'weekly';

interface BriefingResult {
  summary: string;
  details: string[];
  actions: { text: string; level: 'urgent' | 'warn' | 'info'; tab?: string }[];
}
interface KeywordResult { icon: string; message: string; color: string; action?: string }
interface AdResult { headlines: string[]; descriptions: string[]; reasoning: string }
interface WeeklyResult { good: string[]; improve: string[]; recommend: string[] }

const TABS: { key: Tab; label: string }[] = [
  { key: 'briefing', label: '오늘 브리핑' },
  { key: 'keyword', label: '키워드 진단' },
  { key: 'ad', label: '광고소재 추천' },
  { key: 'weekly', label: '주간 비교' },
];

const FREE_QUOTA = getLimits().aiAnalysisPerMonth;

async function callAi<T>(action: string, data: Record<string, unknown>): Promise<T | null> {
  const res = await workerFetch<{ data: T }>('/ai', {
    method: 'POST',
    body: JSON.stringify({ action, data }),
  });
  return res.data;
}

export function AnalyticsPage() {
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
      totals: { impressions: 1000, clicks: 50, cost: 30000, conversions: 3 },
      bizMoney: 500000, targetCpa: 10000, dailyBudget: 50000,
    });
    setBriefing(result);
  });

  const handleKeyword = () => run(async () => {
    if (!keyword) { setError('키워드를 입력하세요'); return; }
    const result = await callAi<KeywordResult>('keyword_health', {
      keyword, bidAmt: 500, qiGrade: 5, rank1Bid: 1500, rank3Bid: 800,
      status: 'ELIGIBLE', impressions: 200, clicks: 10,
    });
    setKeywordResult(result);
  });

  const handleAd = () => run(async () => {
    if (!productName) { setError('상품명을 입력하세요'); return; }
    const result = await callAi<AdResult>('ad_suggestions', {
      productName, region, keywords: adKeywords.split(',').map(k => k.trim()).filter(Boolean),
    });
    setAdResult(result);
  });

  const handleWeekly = () => run(async () => {
    const result = await callAi<WeeklyResult>('weekly_insight', {
      thisWeek: { imp: 7000, clk: 350, cost: 210000, conv: 21 },
      lastWeek: { imp: 6000, clk: 280, cost: 195000, conv: 15 },
      dailyBudget: 50000,
    });
    setWeekly(result);
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
          <span className="text-gray-400"> / {FREE_QUOTA}회 (Free 플랜)</span>
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
                <p className="text-xs text-amber-600 font-medium mb-4">이번달 사용 완료 ({usage}/{FREE_QUOTA}회)</p>
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

      {showUpgrade && (
        <UpgradePrompt
          feature="AI 분석"
          description={`Free 플랜은 월 ${FREE_QUOTA}회만 AI 분석이 가능합니다. Starter로 업그레이드하면 월 30회 사용할 수 있습니다.`}
          usage={`이번달 ${usage}/${FREE_QUOTA}회 사용 완료`}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}
