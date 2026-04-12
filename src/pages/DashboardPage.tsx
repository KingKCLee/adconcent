import { useState, useEffect } from 'react';
import { ShieldCheck, Target, Sparkles, TrendingDown, ExternalLink, Copy, Check } from 'lucide-react';
import { workerFetch } from '@/lib/api';

interface ClickLog {
  ip: string;
  ua: string | null;
  click_at: number;
  keyword: string | null;
  is_suspicious: number;
}

interface StatsResponse {
  ips: { ip: string; count: number; events: { event: string; time: string }[] }[];
  summary: { total: number; totalClicks: number };
}

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;
const SCRIPT_TAG = `<script src="${WORKER_URL}/collect?site_id=YOUR_SITE_ID" async></script>`;

const kpiCards = [
  { label: '부정클릭 차단', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50', value: '0건', sub: '절감 ₩0' },
  { label: '자동입찰 적중률', icon: Target, color: 'text-green-600', bg: 'bg-green-50', value: '- %', sub: '키워드 0개' },
  { label: 'AI 분석 사용', icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50', value: '0/3회', sub: 'Free 플랜' },
  { label: '이번달 절감액', icon: TrendingDown, color: 'text-blue-600', bg: 'bg-blue-50', value: '₩0', sub: '자동입찰 + 차단' },
];

const checklist = [
  { label: '사이트 등록', done: false },
  { label: '스크립트 설치', done: false },
  { label: '네이버 계정 연결', done: false },
  { label: '첫 입찰 설정', done: false },
];

export function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    workerFetch<StatsResponse>('/stats?site_id=hitbunyang')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Click logs (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
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

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Checklist */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">빠른 설정</h3>
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

          {/* AI Insight */}
          <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl border border-violet-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-violet-600" />
              <h3 className="font-semibold text-gray-900">오늘의 AI 인사이트</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">광고 데이터를 AI가 분석하여 최적화 방안을 제안합니다.</p>
            <button className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
              AI 분석 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
