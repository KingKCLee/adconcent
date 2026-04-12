import { useState, useEffect } from 'react';
import { Shield, Ban, TrendingDown, Copy, Check, Code } from 'lucide-react';
import { workerFetch } from '@/lib/api';

interface StatsResponse {
  ips: { ip: string; count: number; firstSeen: string; lastSeen: string; events: { event: string; time: string }[] }[];
  summary: { total: number; totalClicks: number };
}

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;
const SITE_ID = 'hitbunyang';
const SCRIPT_TAG = `<script src="${WORKER_URL}/collect?site_id=${SITE_ID}" async></script>`;

const AVG_CPC = 800; // 추정 평균 CPC

export function ClickFraudPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [installCheck, setInstallCheck] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

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
  const blockedCount = suspiciousIps.length;
  const savedAmount = blockedClicks * AVG_CPC;

  const kpis = [
    { label: '수집 중 (지난 7일)', icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50', value: `${totalClicks.toLocaleString()}건` },
    { label: '자동 차단 IP', icon: Ban, color: 'text-red-600', bg: 'bg-red-50', value: `${blockedCount}개` },
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
    try {
      await workerFetch('/block', {
        method: 'POST',
        body: JSON.stringify({ site_id: SITE_ID, ip, reason: 'manual' }),
      });
      loadStats();
    } catch (e) {
      alert(`차단 실패: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
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
          <h3 className="font-semibold text-gray-900">IP별 클릭 현황</h3>
          <button onClick={loadStats} className="text-xs text-blue-600 hover:underline">새로고침</button>
        </div>
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
                  .map((row) => {
                    const status = row.count >= 10 ? '차단됨' : row.count >= 5 ? '의심' : '정상';
                    const statusClass = row.count >= 10 ? 'bg-red-50 text-red-600' :
                      row.count >= 5 ? 'bg-amber-50 text-amber-600' :
                      'bg-green-50 text-green-600';
                    return (
                      <tr key={row.ip} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-gray-700">{row.ip}</td>
                        <td className="px-5 py-3 text-gray-700 font-medium">{row.count}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{new Date(row.firstSeen).toLocaleString('ko-KR')}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{new Date(row.lastSeen).toLocaleString('ko-KR')}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass}`}>{status}</span>
                        </td>
                        <td className="px-5 py-3">
                          {status !== '차단됨' && (
                            <button
                              onClick={() => handleBlock(row.ip)}
                              className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
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
    </div>
  );
}
