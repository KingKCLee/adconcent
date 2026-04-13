import { useState, useEffect } from 'react';
import { Shield, Ban, TrendingDown, Copy, Check, Code, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { workerFetch } from '@/lib/api';
import { getLimits } from '@/lib/plans';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';
import { usePlan } from '@/hooks/usePlan';

interface StatsResponse {
  ips: { ip: string; count: number; firstSeen: string; lastSeen: string; events: { event: string; time: string }[] }[];
  summary: { total: number; totalClicks: number };
}

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;
const SITE_ID = 'hitbunyang';
const SCRIPT_TAG = `<script src="${WORKER_URL}/collect?site_id=${SITE_ID}" async></script>`;
const AVG_CPC = 800;

export function ClickFraudPage() {
  const { plan, isFree } = usePlan(SITE_ID);
  const limits = getLimits(plan);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [installCheck, setInstallCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [blockedThisMonth, setBlockedThisMonth] = useState(0); // 임시: 로컬 카운터
  const [showUpgrade, setShowUpgrade] = useState(false);

  const loadStats = () => {
    setLoading(true);
    workerFetch<StatsResponse>(`/stats?site_id=${SITE_ID}`)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStats(); }, []);

  const totalClicks = stats?.summary.totalClicks || 0;
  const suspiciousIps = stats?.ips.filter(ip => ip.count >= 5) || [];
  const blockedClicks = suspiciousIps.reduce((sum, ip) => sum + ip.count, 0);
  const savedAmount = blockedClicks * AVG_CPC;
  const canBlock = blockedThisMonth < limits.ipBlockPerMonth;
  const unblockedSuspicious = suspiciousIps.length;

  // Free 플랜: 3일치만 표시
  const cutoffMs = Date.now() - limits.logDays * 86400 * 1000;

  const kpis = [
    { label: '수집 중 (지난 7일)', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50', value: `${totalClicks.toLocaleString()}건` },
    { label: '자동 차단 IP', icon: Ban, color: 'text-red-600', bg: 'bg-red-50', value: `${suspiciousIps.length}개` },
    { label: '절감 광고비 (추정)', icon: TrendingDown, color: 'text-green-600', bg: 'bg-green-50', value: `₩${savedAmount.toLocaleString()}` },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(SCRIPT_TAG);
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
        body: JSON.stringify({ site_id: SITE_ID, ip, reason: 'manual' }),
      });
      setBlockedThisMonth(n => n + 1);
      loadStats();
    } catch (e) {
      alert(`차단 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Free 플랜 경고 배너 */}
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

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map(({ label, icon: Icon, color, bg, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* IP Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">IP별 클릭 현황</h3>
            {isFree && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                {blockedThisMonth}/{limits.ipBlockPerMonth} 차단 사용
              </span>
            )}
          </div>
          <button onClick={loadStats} className="text-xs text-blue-600 hover:underline">새로고침</button>
        </div>

        {/* Free 로그 제한 배너 */}
        {isFree && (
          <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
            💡 최근 {limits.logDays}일치 로그만 표시됩니다. 90일치 로그는 <Link to="/dashboard/billing" className="font-semibold underline">Starter부터</Link> 조회 가능합니다.
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">로딩 중...</div>
        ) : (stats?.ips.length || 0) > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">IP 주소</th>
                  <th className="px-5 py-3 font-medium">클릭 수</th>
                  <th className="px-5 py-3 font-medium">첫 감지</th>
                  <th className="px-5 py-3 font-medium">마지막 감지</th>
                  <th className="px-5 py-3 font-medium">상태</th>
                  <th className="px-5 py-3 font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {stats!.ips
                  .sort((a, b) => b.count - a.count)
                  .map((row, idx) => {
                    const isOld = new Date(row.lastSeen).getTime() < cutoffMs;
                    const isLocked = isFree && isOld;
                    const isSuspicious = row.count >= 5;
                    const status = row.count >= 10 ? '차단됨' : isSuspicious ? '의심' : '정상';
                    const statusClass = row.count >= 10 ? 'bg-red-50 text-red-600' :
                      isSuspicious ? 'bg-amber-50 text-amber-600' :
                      'bg-green-50 text-green-600';
                    const blockReachedLimit = isFree && idx >= limits.ipBlockPerMonth && isSuspicious;
                    return (
                      <tr key={row.ip} className={`border-b border-gray-50 hover:bg-gray-50 ${isLocked ? 'blur-sm select-none' : ''}`}>
                        <td className="px-5 py-3 font-mono text-gray-700">{row.ip}</td>
                        <td className="px-5 py-3 text-gray-700 font-medium">{row.count}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{new Date(row.firstSeen).toLocaleString('ko-KR')}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{new Date(row.lastSeen).toLocaleString('ko-KR')}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass}`}>{status}</span>
                          {blockReachedLimit && (
                            <span className="block text-[10px] text-red-600 font-semibold mt-1">⚠️ 차단 대기 중 — 광고비 소진 중</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
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
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">수집된 클릭 데이터가 없습니다</div>
        )}
      </div>

      {/* Script install guide */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">스크립트 설치 가이드</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">아래 스크립트를 광고 랜딩 페이지의 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">&lt;head&gt;</code> 안에 붙여넣으세요.</p>
        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2 mb-4">
          <code className="text-xs flex-1 overflow-x-auto text-gray-700 font-mono">{SCRIPT_TAG}</code>
          <button onClick={handleCopy} className="p-2 rounded hover:bg-gray-200 text-gray-500 shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
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
          {installCheck === 'ok' && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> Worker 정상 응답</span>}
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
