import { useEffect, useState } from 'react';
import { workerFetch } from '@/lib/api';
import { TrendingUp, Phone, Globe, ShieldAlert, Sparkles } from 'lucide-react';

interface KPI {
  monthly_used_krw: number;
  monthly_budget_krw: number;
  api_used_today: number;
  api_quota_daily: number;
  clicks_30d: number;
  unique_visitors_30d: number;
  suspicious_30d: number;
  fraud_rate_pct: number;
}

interface Savings {
  auto_bid_saved: number;
  fraud_saved: number;
  fraud_blocked_count: number;
  avg_cpc: number;
  total_saved: number;
}

interface Advantage {
  title: string;
  detail: string;
  anonymous_competitor: string;
}

export default function AdminHome() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [savings, setSavings] = useState<Savings | null>(null);
  const [advantages, setAdvantages] = useState<Advantage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workerFetch<KPI>('/api/admin/dashboard/kpi')
      .then(setKpi)
      .catch((e) => setError(String(e.message || e)));
    workerFetch<Savings>('/api/admin/savings/total').then(setSavings).catch(() => {});
    workerFetch<{ advantages: Advantage[] }>('/api/admin/competitive')
      .then((r) => setAdvantages(r.advantages || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">AdConcent 통합 대시보드</h1>
      <p className="text-sm text-gray-500">4채널 통합 KPI · 시흥거모B1 + viphome + hitbunyang LIVE</p>

      {advantages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {advantages.map((a, i) => (
            <div key={i} className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
              <div className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">독점 #{i + 1}</div>
              <div className="font-bold text-sm mt-1 text-gray-900">{a.title}</div>
              <div className="text-[11px] text-gray-600 mt-1.5 leading-snug">{a.detail}</div>
            </div>
          ))}
        </div>
      )}

      {savings && savings.total_saved > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-gray-900">이번달 통합 절감액</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500">자동입찰 절감</div>
              <div className="text-xl font-bold text-green-600">₩{savings.auto_bid_saved.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">부정클릭 차단</div>
              <div className="text-xl font-bold text-orange-600">₩{savings.fraud_saved.toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{savings.fraud_blocked_count} IP × ₩{savings.avg_cpc.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">총 절감</div>
              <div className="text-xl font-bold text-blue-600">₩{savings.total_saved.toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">자동입찰 + 부정클릭 통합</div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card icon={<TrendingUp className="w-4 h-4" />} label="월 광고비" color="#3B82F6"
          value={kpi ? `₩${kpi.monthly_used_krw.toLocaleString()}` : '...'}
          sub={kpi ? `한도 ₩${kpi.monthly_budget_krw.toLocaleString()}` : ''} />
        <Card icon={<Phone className="w-4 h-4" />} label="30d 클릭" color="#10B981"
          value={kpi ? kpi.clicks_30d.toLocaleString() : '...'}
          sub={kpi ? `유니크 ${kpi.unique_visitors_30d.toLocaleString()}` : ''} />
        <Card icon={<ShieldAlert className="w-4 h-4" />} label="부정클릭 30d" color="#F59E0B"
          value={kpi ? `${kpi.fraud_rate_pct}%` : '...'}
          sub={kpi ? `${kpi.suspicious_30d.toLocaleString()}건` : ''} />
        <Card icon={<Globe className="w-4 h-4" />} label="API 사용" color="#8B5CF6"
          value={kpi ? `${kpi.api_used_today}/${kpi.api_quota_daily}` : '...'}
          sub="일일" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-bold text-gray-900 mb-2">매체 별 빠른 이동</h2>
        <p className="text-sm text-gray-500 mb-4">사이드바에서 네이버 / 구글로 들어가 매체별 깊이 분석.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a href="/workspace/naver" className="block px-4 py-3 rounded-lg bg-[#03C75A]/10 text-[#03C75A] font-medium text-sm hover:bg-[#03C75A]/20">
            🟢 네이버 광고 →
          </a>
          <a href="/workspace/google" className="block px-4 py-3 rounded-lg bg-[#4285F4]/10 text-[#4285F4] font-medium text-sm hover:bg-[#4285F4]/20">
            🔵 구글 광고 →
          </a>
          <a href="/workspace/ai" className="block px-4 py-3 rounded-lg bg-violet-100 text-violet-700 font-medium text-sm hover:bg-violet-200">
            ✨ AI 분석 →
          </a>
        </div>
      </div>
    </div>
  );
}

function Card({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <span style={{ color }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
