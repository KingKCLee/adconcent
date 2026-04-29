import { useEffect, useState } from 'react';
import { workerFetch } from '@/lib/api';
import { CreditCard } from 'lucide-react';

interface Tenant {
  id: number;
  name: string;
  plan_tier: string;
  monthly_used_krw: number;
  monthly_ad_budget_krw: number;
  api_used_today: number;
  api_quota_daily: number;
}

const PLAN_INFO: Record<string, { color: string; price: number; budget: number }> = {
  FREE:    { color: 'bg-gray-200 text-gray-700', price: 0, budget: 1_000_000 },
  STARTER: { color: 'bg-emerald-600 text-white', price: 9_900, budget: 5_000_000 },
  GROWTH:  { color: 'bg-blue-600 text-white', price: 24_900, budget: 10_000_000 },
  PRO:     { color: 'bg-violet-600 text-white', price: 49_900, budget: 50_000_000 },
  ENT:     { color: 'bg-rose-600 text-white', price: 0, budget: 0 },
};

export default function AdminBilling() {
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    workerFetch<{ tenant: Tenant }>('/api/admin/tenant/me')
      .then((r) => setTenant(r.tenant))
      .catch(() => {});
  }, []);

  const plan = tenant ? PLAN_INFO[tenant.plan_tier] || PLAN_INFO.FREE : PLAN_INFO.FREE;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-pink-600" />
        <h1 className="text-xl font-bold text-gray-900">결제 / 플랜</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs text-gray-500 mb-1">현재 플랜</div>
            <div className={`inline-flex text-sm font-bold px-3 py-1 rounded-full ${plan.color}`}>
              {tenant?.plan_tier ?? '...'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">사업자명</div>
            <div className="font-bold">{tenant?.name ?? '...'}</div>
          </div>
        </div>

        <div className="space-y-3">
          <Row
            label="월 광고비"
            current={tenant?.monthly_used_krw}
            max={tenant?.monthly_ad_budget_krw}
            prefix="₩"
          />
          <Row
            label="일일 API"
            current={tenant?.api_used_today}
            max={tenant?.api_quota_daily}
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-3xl">
        <h2 className="font-bold text-sm mb-4">플랜 비교</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {(['FREE', 'STARTER', 'GROWTH', 'PRO'] as const).map((k) => (
            <div key={k} className={`border rounded-lg p-4 ${tenant?.plan_tier === k ? 'border-violet-500 bg-violet-50' : 'border-gray-200'}`}>
              <div className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded ${PLAN_INFO[k].color}`}>{k}</div>
              <div className="mt-2 text-lg font-bold">₩{PLAN_INFO[k].price.toLocaleString()}<span className="text-xs text-gray-400">/월</span></div>
              <div className="text-[11px] text-gray-500 mt-1">광고비 한도 ₩{PLAN_INFO[k].budget.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900 max-w-3xl">
        <p className="font-bold">💳 토스페이먼츠 결제 (심사 진행 중)</p>
        <p className="text-xs mt-1">
          MID: bill_adconc91s · 심사 통과 → LIVE 키 등록 시 카드 등록 모달 자동 활성화 + 매월 1일 자동 결제 cron LIVE.
        </p>
      </div>
    </div>
  );
}

function Row({ label, current, max, prefix = '' }: { label: string; current?: number; max?: number; prefix?: string }) {
  const pct = current != null && max ? Math.min(100, Math.round((current / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>{prefix}{current?.toLocaleString() ?? '...'} / {prefix}{max?.toLocaleString() ?? '...'}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
