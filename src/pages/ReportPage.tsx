import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Mail, Loader2, CheckCircle2, AlertCircle, Lightbulb, X,
  Printer, TrendingUp, MousePointerClick, CircleDollarSign, Target,
} from 'lucide-react';
import { workerFetch } from '@/lib/api';
import { useSite } from '@/contexts/SiteContext';

interface WeeklyResult {
  good: string[];
  improve: string[];
  recommend: string[];
}

interface ReportTotals {
  cost?: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
  roas?: number;
}

interface KeywordPerf {
  keyword: string;
  cost?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  conversions?: number;
}

interface ReportSummary {
  totals?: ReportTotals;
  top_keywords?: KeywordPerf[];
}

type Period = 'this_week' | 'last_week' | 'this_month' | 'custom';

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
const won = (n: number | undefined | null) => `₩${(n ?? 0).toLocaleString()}`;
const num = (n: number | undefined | null) => (n ?? 0).toLocaleString();

function rangeFor(p: Period, custom?: { since: string; until: string }) {
  const today = new Date();
  if (p === 'this_week') {
    const day = today.getDay();
    const since = new Date(today);
    since.setDate(today.getDate() - day);
    return { since: fmtDate(since), until: fmtDate(today) };
  }
  if (p === 'last_week') {
    const day = today.getDay();
    const sundayOfThisWeek = new Date(today);
    sundayOfThisWeek.setDate(today.getDate() - day);
    const lastSat = new Date(sundayOfThisWeek);
    lastSat.setDate(sundayOfThisWeek.getDate() - 1);
    const lastSun = new Date(lastSat);
    lastSun.setDate(lastSat.getDate() - 6);
    return { since: fmtDate(lastSun), until: fmtDate(lastSat) };
  }
  if (p === 'this_month') {
    const since = new Date(today.getFullYear(), today.getMonth(), 1);
    return { since: fmtDate(since), until: fmtDate(today) };
  }
  return custom ?? { since: fmtDate(today), until: fmtDate(today) };
}

export function ReportPage() {
  const { siteId } = useSite();
  const [period, setPeriod] = useState<Period>('this_week');
  const [customSince, setCustomSince] = useState(fmtDate(new Date()));
  const [customUntil, setCustomUntil] = useState(fmtDate(new Date()));

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [report, setReport] = useState<WeeklyResult | null>(null);
  const [error, setError] = useState('');

  const dates = useMemo(
    () => rangeFor(period, { since: customSince, until: customUntil }),
    [period, customSince, customUntil],
  );

  const loadSummary = async () => {
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      // 1순위: /reports/summary 시도
      let s: ReportSummary | null = null;
      try {
        const r = await workerFetch<{ data?: ReportSummary } | ReportSummary>(
          `/reports/summary?site_id=${siteId}&since=${dates.since}&until=${dates.until}`,
        );
        s = (r as any)?.data ?? (r as any);
      } catch {
        // 폴백: /naver/stats + /naver/keyword-stats 합산
        const [statsR, kwR] = await Promise.allSettled([
          workerFetch<any>('/naver/stats', {
            method: 'POST',
            body: JSON.stringify({
              site_id: siteId,
              ids: [],
              timeRange: { since: dates.since, until: dates.until },
              fields: ['clkCnt', 'impCnt', 'salesAmt', 'crto'],
              idType: 'campaign',
              timeUnit: 'day',
            }),
          }),
          workerFetch<any>(`/naver/keyword-stats?site_id=${siteId}&offset=0&limit=10`),
        ]);
        const totals = statsR.status === 'fulfilled' ? statsR.value?.totals : null;
        const kwData =
          kwR.status === 'fulfilled'
            ? Array.isArray(kwR.value)
              ? kwR.value
              : (kwR.value?.data ?? kwR.value?.keywords ?? [])
            : [];
        s = {
          totals: totals
            ? {
                cost: totals.salesAmt,
                clicks: totals.clkCnt,
                impressions: totals.impCnt,
                conversions: Math.round(totals.crto ?? 0),
                ctr: totals.impCnt > 0 ? (totals.clkCnt / totals.impCnt) * 100 : 0,
                cpc: totals.clkCnt > 0 ? Math.round(totals.salesAmt / totals.clkCnt) : 0,
              }
            : undefined,
          top_keywords: kwData.slice(0, 5).map((k: any) => ({
            keyword: k.keyword,
            cost: k.salesAmt ?? k.cost,
            clicks: k.clkCnt ?? k.clicks,
            ctr: k.ctr,
            cpc: k.cpc,
            conversions: k.conversions,
          })),
        };
      }
      setSummary(s);
    } catch (e) {
      setError((e as Error).message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, dates.since, dates.until]);

  const handleGenerate = async () => {
    if (!siteId) {
      setError('사이트가 선택되지 않았습니다');
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const t = summary?.totals ?? {};
      const res = await workerFetch<{ data: WeeklyResult }>('/ai', {
        method: 'POST',
        body: JSON.stringify({
          action: 'weekly_insight',
          data: {
            site_id: siteId,
            period: { since: dates.since, until: dates.until },
            thisWeek: {
              imp: t.impressions ?? 0,
              clk: t.clicks ?? 0,
              cost: t.cost ?? 0,
              conv: t.conversions ?? 0,
            },
          },
        }),
      });
      setReport(res.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('adconcent.reportEmail', email); } catch {}
    }
    setEmailSaved(true);
    setTimeout(() => {
      setShowEmailModal(false);
      setEmailSaved(false);
    }, 1500);
  };

  const totals = summary?.totals ?? {};
  const topKeywords = summary?.top_keywords ?? [];

  const kpis = [
    { label: '총 광고비', icon: CircleDollarSign, color: 'text-blue-600', bg: 'bg-blue-50', value: won(totals.cost) },
    { label: '총 클릭', icon: MousePointerClick, color: 'text-emerald-600', bg: 'bg-emerald-50', value: num(totals.clicks) },
    { label: '전환수', icon: Target, color: 'text-violet-600', bg: 'bg-violet-50', value: num(totals.conversions) },
    { label: '평균 CPC', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', value: won(totals.cpc) },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            성과 보고
          </h2>
          <p className="text-sm text-gray-500 mt-1">기간별 광고 성과 + AI 인사이트 리포트</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" />
            PDF 다운로드
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Mail className="w-4 h-4" />
            이메일 수신
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 mr-1">기간:</span>
        {(
          [
            { id: 'this_week', label: '이번주' },
            { id: 'last_week', label: '지난주' },
            { id: 'this_month', label: '이번달' },
            { id: 'custom', label: '직접입력' },
          ] as { id: Period; label: string }[]
        ).map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              period === p.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input
              type="date"
              value={customSince}
              onChange={(e) => setCustomSince(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={customUntil}
              onChange={(e) => setCustomUntil(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {dates.since} ~ {dates.until}
        </span>
      </div>

      {/* KPI 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, icon: Icon, color, bg, value }) => (
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

      {/* TOP 5 keywords */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">키워드 TOP 5</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : topKeywords.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">데이터가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">키워드</th>
                  <th className="px-3 py-3 font-medium text-right">광고비</th>
                  <th className="px-3 py-3 font-medium text-right">클릭</th>
                  <th className="px-3 py-3 font-medium text-right">CTR</th>
                  <th className="px-3 py-3 font-medium text-right">CPC</th>
                  <th className="px-3 py-3 font-medium text-right">전환</th>
                </tr>
              </thead>
              <tbody>
                {topKeywords.map((k, i) => (
                  <tr key={`${k.keyword}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{k.keyword}</td>
                    <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(k.cost)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{num(k.clicks)}</td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {k.ctr != null ? `${k.ctr.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{k.cpc ? won(k.cpc) : '-'}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{num(k.conversions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Insight */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" />
            AI 주간 인사이트
          </h3>
          {report && (
            <button onClick={handleGenerate} className="text-xs text-violet-600 hover:underline">
              다시 생성
            </button>
          )}
        </div>

        {!report && !aiLoading && (
          <div className="text-center py-8">
            <Sparkles className="w-10 h-10 text-violet-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">AI가 이번 기간 성과를 분석합니다</p>
            <button
              onClick={handleGenerate}
              disabled={loading || !summary}
              className="px-6 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              AI 인사이트 생성
            </button>
          </div>
        )}

        {aiLoading && (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-violet-600 mx-auto animate-spin" />
            <p className="text-sm text-gray-500 mt-3">AI가 분석 중입니다...</p>
          </div>
        )}

        {error && !aiLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {report && !aiLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-5 border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-700">잘 된 점</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                {report.good.map((g, i) => (
                  <li key={i} className="flex gap-1.5"><span>•</span><span>{g}</span></li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50 rounded-lg p-5 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h4 className="font-semibold text-amber-700">개선 필요</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                {report.improve.map((g, i) => (
                  <li key={i} className="flex gap-1.5"><span>•</span><span>{g}</span></li>
                ))}
              </ul>
            </div>
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-blue-700">추천 조치</h4>
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                {report.recommend.map((g, i) => (
                  <li key={i} className="flex gap-1.5"><span>•</span><span>{g}</span></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Email modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowEmailModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">이메일 수신 설정</h3>
            <p className="text-sm text-gray-500 mb-4">
              매주 월요일 오전 9시에 AI 주간 리포트를 이메일로 받아보세요.
            </p>
            <form onSubmit={handleSaveEmail} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
              >
                {emailSaved ? '✓ 저장 완료' : '저장하기'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
