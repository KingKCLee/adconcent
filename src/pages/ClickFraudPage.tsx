import { useEffect, useMemo, useState } from 'react';
import {
  Shield, Ban, TrendingDown, Copy, Check, Code, AlertTriangle,
  MousePointerClick, Loader2, Monitor, Smartphone, CircleDollarSign, ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { workerFetch } from '@/lib/api';
import { getLimits } from '@/lib/plans';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';
import { usePlan } from '@/hooks/usePlan';
import { useSite } from '@/contexts/SiteContext';

type Period = 'today' | '7d' | '30d';

interface HourBucket {
  hour: number;
  clicks: number;
  blocked: number;
}

interface TopIp {
  ip: string;
  count: number;
  status?: string;
  first_seen?: string;
  last_seen?: string;
  firstSeen?: string;
  lastSeen?: string;
}

interface RecentLog {
  id?: string | number;
  time?: string;
  created_at?: string;
  ip: string;
  keyword?: string;
  device?: string;
  status?: string;
}

interface StatsDetailResponse {
  totals?: {
    total_clicks?: number;
    blocked?: number;
    suspicious?: number;
    saved?: number;
  };
  total_clicks?: number;
  blocked?: number;
  suspicious?: number;
  saved?: number;
  by_hour?: HourBucket[];
  top_ips?: TopIp[];
  recent_logs?: RecentLog[];
}

interface NaverStatsResponse {
  totals?: { impCnt: number; clkCnt: number; salesAmt: number; crto?: number };
}

interface FraudSettings {
  threshold_count?: number;
  threshold_minutes?: number;
  night_mode?: number;
  night_threshold_count?: number;
  block_vpn?: number;
}

interface PixelStatus {
  ips: unknown[];
  totalClicks: number;
}

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;
const FALLBACK_AVG_CPC = 800;

const num = (n: number) => (n ?? 0).toLocaleString();
const won = (n: number) => `₩${num(n ?? 0)}`;
const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

function buildPixelSnippet(siteId: string) {
  return `<!-- AdConcent 부정클릭 차단 픽셀 -->
<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var data = {
    site_id: '${siteId}',
    keyword: params.get('nk') || params.get('keyword') || '',
    device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'pc',
    referrer: document.referrer,
    landing_url: window.location.href,
    ts: Date.now()
  };
  fetch('${WORKER_URL}/collect', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data),
    keepalive: true
  }).catch(function(){});
})();
</script>`;
}

function rangeFor(p: Period) {
  const today = new Date();
  if (p === 'today') {
    return { since: fmtDate(today), until: fmtDate(today) };
  }
  if (p === '7d') {
    const s = new Date(today);
    s.setDate(today.getDate() - 6);
    return { since: fmtDate(s), until: fmtDate(today) };
  }
  // 30d
  const s = new Date(today);
  s.setDate(today.getDate() - 29);
  return { since: fmtDate(s), until: fmtDate(today) };
}

export function ClickFraudPage() {
  const { siteId } = useSite();
  const { plan, isFree } = usePlan();
  const limits = getLimits(plan);
  const PIXEL_SNIPPET = buildPixelSnippet(siteId);

  const [period, setPeriod] = useState<Period>('7d');
  const [detail, setDetail] = useState<StatsDetailResponse | null>(null);
  const [naverTotals, setNaverTotals] = useState<{ clicks: number; cost: number; impressions: number; conversions: number } | null>(null);
  const [fraudSettings, setFraudSettings] = useState<FraudSettings | null>(null);
  const [pixelStatus, setPixelStatus] = useState<PixelStatus | null>(null);
  const [avgCpc, setAvgCpc] = useState<number>(FALLBACK_AVG_CPC);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [installCheck, setInstallCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [blockedThisMonth, setBlockedThisMonth] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const dates = useMemo(() => rangeFor(period), [period]);

  const loadStats = () => {
    if (!siteId) return;
    setLoading(true);
    Promise.allSettled([
      workerFetch<StatsDetailResponse>(`/stats/detail?site_id=${siteId}&period=${period}`),
      workerFetch<NaverStatsResponse>('/naver/stats', {
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
    ]).then(([detailR, naverR]) => {
      if (detailR.status === 'fulfilled') setDetail(detailR.value);
      else setDetail(null);
      if (naverR.status === 'fulfilled') {
        const t = naverR.value?.totals;
        if (t) {
          setNaverTotals({
            clicks: t.clkCnt ?? 0,
            cost: t.salesAmt ?? 0,
            impressions: t.impCnt ?? 0,
            conversions: Math.round(t.crto ?? 0),
          });
          if (t.clkCnt > 0) setAvgCpc(Math.round(t.salesAmt / t.clkCnt));
        } else {
          setNaverTotals(null);
        }
      } else {
        setNaverTotals(null);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, period]);

  // fraud_settings + 픽셀 수집 상태 (한 번만)
  useEffect(() => {
    if (!siteId) return;
    Promise.allSettled([
      workerFetch<{ data?: FraudSettings; exists?: boolean }>(`/fraud-settings?site_id=${siteId}`),
      workerFetch<{ ips?: unknown[]; summary?: { totalClicks?: number } }>(`/stats?site_id=${siteId}`),
    ]).then(([fsR, pxR]) => {
      if (fsR.status === 'fulfilled' && fsR.value?.data) {
        setFraudSettings(fsR.value.data);
      }
      if (pxR.status === 'fulfilled') {
        setPixelStatus({
          ips: pxR.value?.ips ?? [],
          totalClicks: pxR.value?.summary?.totalClicks ?? 0,
        });
      }
    });
  }, [siteId]);

  const totals = useMemo(() => {
    const t = detail?.totals ?? {};
    return {
      totalClicks: t.total_clicks ?? detail?.total_clicks ?? 0,
      blocked: t.blocked ?? detail?.blocked ?? 0,
      suspicious: t.suspicious ?? detail?.suspicious ?? 0,
      saved: t.saved ?? detail?.saved ?? 0,
    };
  }, [detail]);

  const blockRate = totals.totalClicks > 0
    ? ((totals.blocked / totals.totalClicks) * 100).toFixed(1)
    : '0.0';
  const savedAmount = totals.saved > 0 ? totals.saved : totals.blocked * avgCpc;

  const hourBuckets: HourBucket[] = useMemo(() => {
    const raw = detail?.by_hour ?? [];
    // Worker가 누락된 시간을 안 줄 수 있으므로 0~23 보강
    const map = new Map<number, HourBucket>();
    for (const b of raw) map.set(b.hour, b);
    return Array.from({ length: 24 }, (_, h) => map.get(h) ?? { hour: h, clicks: 0, blocked: 0 });
  }, [detail]);

  const topIps: TopIp[] = detail?.top_ips ?? [];
  const recentLogs: RecentLog[] = detail?.recent_logs ?? [];

  const canBlock = blockedThisMonth < limits.ipBlockPerMonth;
  const unblockedSuspicious = totals.suspicious;

  const periodLabel =
    period === 'today' ? '오늘' :
    period === '7d' ? '최근 7일' :
    '최근 30일';

  // 네이버 데이터 우선, 없으면 픽셀 totals.totalClicks 폴백
  const displayClicks = naverTotals?.clicks ?? totals.totalClicks;
  const displayCost = naverTotals?.cost ?? 0;
  const displayCpc = naverTotals && naverTotals.clicks > 0
    ? Math.round(naverTotals.cost / naverTotals.clicks)
    : avgCpc;

  const kpis = [
    {
      label: '총 클릭수',
      icon: MousePointerClick,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      value: `${num(displayClicks)}건`,
      sub: naverTotals ? `네이버 ${periodLabel}` : `픽셀 ${periodLabel}`,
    },
    {
      label: '총 광고비',
      icon: CircleDollarSign,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      value: won(displayCost),
      sub: naverTotals ? '네이버 검색광고' : '데이터 없음',
    },
    {
      label: '평균 CPC',
      icon: TrendingDown,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      value: won(displayCpc),
      sub: '클릭당 비용',
    },
    {
      label: '차단 / 절감',
      icon: ShieldCheck,
      color: 'text-green-600',
      bg: 'bg-green-50',
      value: `${num(totals.blocked)}건`,
      sub: `절감 ${won(savedAmount)} · 차단율 ${blockRate}%`,
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(PIXEL_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallCheck = async () => {
    setInstallCheck('checking');
    try {
      const res = await fetch(`${WORKER_URL}/health`);
      setInstallCheck(res.ok ? 'ok' : 'fail');
    } catch {
      setInstallCheck('fail');
    }
  };

  const handleBlock = async (ip: string) => {
    if (!canBlock) {
      setShowUpgrade(true);
      return;
    }
    try {
      await workerFetch('/block', {
        method: 'POST',
        body: JSON.stringify({ site_id: siteId, ip, reason: 'manual' }),
      });
      setBlockedThisMonth((n) => n + 1);
      loadStats();
    } catch (e) {
      alert(`차단 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 mr-2">기간:</span>
        {(
          [
            { id: 'today', label: '오늘' },
            { id: '7d', label: '7일' },
            { id: '30d', label: '30일' },
          ] as { id: Period; label: string }[]
        ).map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              period === p.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-2">{dates.since} ~ {dates.until}</span>
        <button onClick={loadStats} className="ml-auto text-xs text-blue-600 hover:underline">
          새로고침
        </button>
      </div>

      {/* 픽셀 상태 + 자동 차단 규칙 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 픽셀 상태 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${
            pixelStatus && pixelStatus.totalClicks > 0 ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <Shield className={`w-5 h-5 ${
              pixelStatus && pixelStatus.totalClicks > 0 ? 'text-green-600' : 'text-red-600'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 text-sm">픽셀 설치 상태</h3>
              {pixelStatus && pixelStatus.totalClicks > 0 ? (
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  🟢 수집 중
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                  🔴 미설치
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {pixelStatus && pixelStatus.totalClicks > 0
                ? `누적 클릭 ${pixelStatus.totalClicks.toLocaleString()}건 · IP별 분석 활성`
                : '픽셀 코드를 설치하면 IP별 클릭 패턴 분석이 가능합니다'}
            </p>
          </div>
        </div>

        {/* 자동 차단 규칙 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg shrink-0 bg-amber-50 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm mb-1">자동 차단 규칙</h3>
            {fraudSettings ? (
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">
                  {fraudSettings.threshold_minutes}분 내 {fraudSettings.threshold_count}회
                </span>{' '}
                초과 시 자동 차단
                {fraudSettings.night_mode ? (
                  <>
                    {' · '}
                    <span className="text-violet-600">야간 강화({fraudSettings.night_threshold_count}회)</span>
                  </>
                ) : null}
                {fraudSettings.block_vpn ? (
                  <>
                    {' · '}
                    <span className="text-blue-600">VPN 차단</span>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-xs text-gray-400">규칙 로드 중...</p>
            )}
          </div>
        </div>
      </div>

      {/* Free 플랜 경고 */}
      {isFree && unblockedSuspicious > limits.ipBlockPerMonth && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ 의심 IP {unblockedSuspicious - limits.ipBlockPerMonth}개가 차단되지 않아 광고비가 소진되고 있습니다
            </p>
          </div>
          <Link
            to="/dashboard/billing"
            className="text-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium shrink-0"
          >
            지금 차단하기 →
          </Link>
        </div>
      )}

      {/* KPI 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, icon: Icon, color, bg, value, sub }) => (
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
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Hourly chart */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-900">시간대별 클릭 / 차단</h3>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              불러오는 중...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(h) => `${h}시`} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="clicks" name="클릭" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="blocked" name="차단" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top IPs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">상위 차단 IP</h3>
          {isFree && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">
              {blockedThisMonth}/{limits.ipBlockPerMonth} 차단 사용
            </span>
          )}
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : topIps.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 mb-2">집계된 IP가 없습니다</p>
            <p className="text-xs text-gray-400 mb-4">
              💡 픽셀을 설치하면 IP별 클릭 패턴 · 봇 탐지 · 차단 기능을 사용할 수 있습니다.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 max-w-xl mx-auto text-left">
              <pre className="text-[10px] text-gray-700 font-mono whitespace-pre-wrap break-all max-h-40 overflow-auto">{PIXEL_SNIPPET}</pre>
              <button
                onClick={handleCopy}
                className="mt-2 text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? '복사됨' : '코드 복사'}
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">IP 주소</th>
                  <th className="px-3 py-3 font-medium text-right">클릭 수</th>
                  <th className="px-3 py-3 font-medium text-center">상태</th>
                  <th className="px-3 py-3 font-medium">최초 감지</th>
                  <th className="px-3 py-3 font-medium">마지막 감지</th>
                  <th className="px-3 py-3 font-medium text-center">액션</th>
                </tr>
              </thead>
              <tbody>
                {topIps.map((row, idx) => {
                  const first = row.first_seen ?? row.firstSeen;
                  const last = row.last_seen ?? row.lastSeen;
                  const status = row.status ?? (row.count >= 10 ? '차단됨' : row.count >= 5 ? '의심' : '정상');
                  const statusClass =
                    status === '차단됨' ? 'bg-red-50 text-red-600' :
                    status === '의심' ? 'bg-amber-50 text-amber-600' :
                    'bg-green-50 text-green-600';
                  const blockReachedLimit = isFree && idx >= limits.ipBlockPerMonth && status === '의심';
                  return (
                    <tr key={`${row.ip}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-gray-700">{row.ip}</td>
                      <td className="px-3 py-3 text-right text-gray-700 font-medium">{num(row.count)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {first ? new Date(first).toLocaleString('ko-KR') : '-'}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {last ? new Date(last).toLocaleString('ko-KR') : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {status !== '차단됨' && (
                          <button
                            onClick={() => handleBlock(row.ip)}
                            className={`text-xs px-2.5 py-1 rounded border ${
                              blockReachedLimit
                                ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                                : 'border-red-200 text-red-600 hover:bg-red-50'
                            }`}
                          >
                            차단
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

      {/* Recent logs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">최근 클릭 로그</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : recentLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">로그가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 font-medium">시간</th>
                  <th className="px-3 py-3 font-medium">IP</th>
                  <th className="px-3 py-3 font-medium">키워드</th>
                  <th className="px-3 py-3 font-medium text-center">기기</th>
                  <th className="px-3 py-3 font-medium text-center">상태</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((row, idx) => {
                  const t = row.time ?? row.created_at;
                  const dev = (row.device ?? '').toLowerCase();
                  const status = row.status ?? '정상';
                  const statusClass =
                    status === '차단' || status === 'blocked' ? 'bg-red-50 text-red-600' :
                    status === '의심' || status === 'suspicious' ? 'bg-amber-50 text-amber-600' :
                    'bg-green-50 text-green-600';
                  return (
                    <tr key={row.id ?? `${row.ip}-${idx}`} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {t ? new Date(t).toLocaleString('ko-KR') : '-'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-700">{row.ip}</td>
                      <td className="px-3 py-3 text-gray-700">{row.keyword || <span className="text-gray-300">-</span>}</td>
                      <td className="px-3 py-3 text-center">
                        {dev.includes('mobile') || dev === 'm' ? (
                          <Smartphone className="w-3.5 h-3.5 text-violet-500 inline" />
                        ) : dev.includes('pc') ? (
                          <Monitor className="w-3.5 h-3.5 text-blue-500 inline" />
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${statusClass}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Script install guide */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">픽셀 설치 가이드</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          아래 픽셀 코드를 광고 랜딩 페이지의{' '}
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">&lt;head&gt;</code> 또는 페이지 최상단에 붙여넣으세요.
          URL 파라미터 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">?nk=키워드</code>를 자동 수집합니다.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <pre className="text-[11px] text-gray-700 font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto">{PIXEL_SNIPPET}</pre>
          <button
            onClick={handleCopy}
            className="mt-3 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 inline-flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '복사됨' : '코드 복사'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleInstallCheck}
            disabled={installCheck === 'checking'}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {installCheck === 'checking' ? '확인 중...' : '설치 확인'}
          </button>
          {installCheck === 'ok' && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="w-4 h-4" /> Worker 정상 응답
            </span>
          )}
          {installCheck === 'fail' && <span className="text-sm text-red-600">Worker 응답 실패</span>}
        </div>
      </div>

      {showUpgrade && (
        <UpgradePrompt
          feature="IP 차단"
          description={`Free 플랜은 월 ${limits.ipBlockPerMonth}개까지만 IP를 차단할 수 있습니다. Starter 플랜으로 업그레이드하면 무제한 차단이 가능합니다.`}
          usage={`이번달 ${blockedThisMonth}/${limits.ipBlockPerMonth}개 차단 완료`}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}
