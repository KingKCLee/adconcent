import { useState } from 'react';
import { Check, Sparkles, X, Loader2 } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useSite } from '@/contexts/SiteContext';
import type { PlanType } from '@/lib/plans';
import { workerFetch } from '@/lib/api';

const usage = [
  { label: 'IP 차단', current: 1, max: 3 },
  { label: 'AI 분석', current: 0, max: 1 },
  { label: '클릭 로그', current: 3, max: 3, unit: '일' },
];

const plans = [
  {
    name: 'Free',
    price: '0',
    color: 'gray',
    features: [
      { text: '부정클릭 탐지 (무제한)', has: true },
      { text: 'IP 차단 월 3개', has: true },
      { text: 'AI 분석 월 1회', has: true },
      { text: '클릭 로그 3일', has: true },
      { text: '자동입찰', has: false },
      { text: '환급 CSV', has: false },
      { text: '구글·Meta 연동', has: false },
    ],
  },
  {
    name: 'Starter',
    price: '9,900',
    color: 'blue',
    features: [
      { text: 'IP 차단 무제한', has: true },
      { text: 'AI 분석 월 30회', has: true },
      { text: '자동입찰 키워드 50개', has: true },
      { text: '클릭 로그 90일', has: true },
      { text: '환급 CSV 다운로드', has: true },
      { text: '이메일 지원', has: true },
    ],
  },
  {
    name: 'Growth',
    price: '24,900',
    color: 'violet',
    badge: '추천',
    features: [
      { text: 'Starter 전부 포함', has: true },
      { text: '구글 광고 연동', has: true },
      { text: '키워드 자동 확장', has: true },
      { text: '통합 실적 분석', has: true },
      { text: 'AI 주간 리포트', has: true },
    ],
  },
  {
    name: 'Pro',
    price: '49,900',
    color: 'gray-dark',
    features: [
      { text: 'Growth 전부 포함', has: true },
      { text: 'Meta · YouTube 연동', has: true },
      { text: 'AI 분석 무제한', has: true },
      { text: '다중 사이트 (최대 5개)', has: true },
      { text: '대행사 멀티계정 관리', has: true },
    ],
  },
];

const faqs = [
  { q: '언제든 플랜을 변경할 수 있나요?', a: '네, 언제든 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 다음 결제일부터 변경된 플랜이 적용됩니다.' },
  { q: '환불 정책은 어떻게 되나요?', a: '결제 후 7일 이내에는 100% 환불이 가능합니다. 그 이후에는 사용량에 따라 일할 계산되어 환불됩니다.' },
  { q: 'Free 플랜은 영구적으로 사용 가능한가요?', a: '네, Free 플랜은 계속 무료로 이용 가능합니다. 단, 사용량 제한이 있으며 일부 고급 기능은 제한됩니다.' },
];

const PLAN_BADGE_STYLES: Record<PlanType, string> = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-emerald-100 text-emerald-700',
  growth: 'bg-blue-100 text-blue-700',
  pro: 'bg-violet-100 text-violet-700',
};

const PLAN_DESC: Record<PlanType, string> = {
  free: '무료 플랜을 이용 중입니다',
  starter: 'Starter 플랜을 이용 중입니다',
  growth: 'Growth 플랜을 이용 중입니다',
  pro: 'Pro 플랜을 이용 중입니다',
};

export function BillingPage() {
  const { plan: currentPlan, isLoading: planLoading } = usePlan();
  const { siteId, refresh } = useSite();
  const planLabel = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Current plan */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">현재 플랜</h3>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_BADGE_STYLES[currentPlan]}`}>
                {planLoading ? '...' : planLabel}
              </span>
            </div>
            <p className="text-sm text-gray-500">{PLAN_DESC[currentPlan]}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {usage.map(({ label, current, max, unit }) => {
            const pct = (current / max) * 100;
            const isFull = pct >= 100;
            return (
              <div key={label} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-sm font-semibold ${isFull ? 'text-red-600' : 'text-gray-900'}`}>
                    {current} / {max}{unit || '개'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-red-500' : 'bg-blue-600'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plans */}
      <section>
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">플랜 업그레이드</h3>
          <p className="text-sm text-gray-500">광고 규모에 맞는 플랜을 선택하세요</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const isHighlighted = plan.color === 'violet';
            const isCurrent = plan.name.toLowerCase() === currentPlan;
            return (
              <div
                key={plan.name}
                className={`bg-white rounded-xl p-6 relative ${
                  isHighlighted ? 'border-2 border-violet-500 shadow-lg' :
                  isCurrent ? 'border-2 border-gray-300' :
                  'border border-gray-200'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {plan.badge}
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gray-600 text-white text-xs font-bold px-3 py-1 rounded-full">현재 플랜</span>
                  </div>
                )}
                <div className="mb-5">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h4>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.price === '0' ? '무료' : plan.price}</span>
                    {plan.price !== '0' && <span className="text-sm text-gray-500">원/월</span>}
                  </div>
                </div>
                <ul className="space-y-2.5 mb-6 min-h-[180px]">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-sm ${f.has ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                      {f.has ? (
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                          plan.color === 'violet' ? 'text-violet-600' :
                          plan.color === 'blue' ? 'text-blue-600' :
                          'text-gray-600'
                        }`} />
                      ) : (
                        <X className="w-4 h-4 shrink-0 mt-0.5 text-gray-300" />
                      )}
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent || planLoading}
                  onClick={() => setUpgradeTarget(plan.name.toLowerCase())}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    isCurrent ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                    plan.color === 'violet' ? 'bg-violet-600 text-white hover:bg-violet-700' :
                    plan.color === 'blue' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {isCurrent ? '현재 플랜' : '업그레이드'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-5">자주 묻는 질문</h3>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <details key={i} className="group border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
              <summary className="text-sm font-medium text-gray-900 cursor-pointer hover:text-violet-600 list-none flex items-center justify-between">
                {f.q}
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <p className="text-sm text-gray-600 mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {upgradeTarget && (
        <UpgradeModal
          targetPlan={upgradeTarget}
          siteId={siteId}
          onClose={() => setUpgradeTarget(null)}
          onSuccess={async () => {
            setUpgradeTarget(null);
            await refresh();
            showToast(`업그레이드 완료! ${upgradeTarget.charAt(0).toUpperCase() + upgradeTarget.slice(1)} 플랜이 활성화되었습니다`);
          }}
          onError={(msg) => {
            setUpgradeTarget(null);
            showToast(`업그레이드 실패: ${msg}`);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg max-w-md text-center">
          {toast}
        </div>
      )}
    </div>
  );
}

const PLAN_PRICES: Record<string, string> = {
  starter: '9,900',
  growth: '24,900',
  pro: '49,900',
};

const PLAN_BENEFITS: Record<string, string[]> = {
  starter: ['IP 차단 무제한', 'AI 분석 월 30회', '자동입찰 키워드 50개', '클릭 로그 90일'],
  growth: ['Starter 전부 포함', '구글 광고 연동', '키워드 자동 확장', 'AI 주간 리포트'],
  pro: ['Growth 전부 포함', 'Meta·YouTube 연동', 'AI 분석 무제한', '다중 사이트 5개'],
};

function UpgradeModal(props: {
  targetPlan: string;
  siteId: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const { targetPlan, siteId, onClose, onSuccess, onError } = props;
  const [submitting, setSubmitting] = useState(false);
  const planLabel = targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1);
  const price = PLAN_PRICES[targetPlan] ?? '0';
  const benefits = PLAN_BENEFITS[targetPlan] ?? [];

  const handleUpgrade = async () => {
    if (!siteId) {
      onError('사이트가 선택되지 않았습니다');
      return;
    }
    setSubmitting(true);
    try {
      await workerFetch(`/sites/${siteId}`, {
        method: 'PUT',
        body: JSON.stringify({ plan: targetPlan }),
      });
      onSuccess();
    } catch (e: any) {
      onError(e?.message ?? '알 수 없는 오류');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-1">{planLabel} 플랜으로 업그레이드</h3>
        <p className="text-sm text-gray-500 mb-5">월 {price}원 (정식 출시 후 자동결제)</p>

        <ul className="space-y-2 mb-5">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
          <p className="text-xs font-semibold text-amber-900 mb-1">🎁 베타 서비스 안내</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            현재 베타 서비스 기간으로 결제 없이 즉시 업그레이드됩니다. 정식 서비스 출시 후 자동결제가 시작됩니다.
          </p>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={submitting}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? '업그레이드 중...' : '무료로 업그레이드 (베타)'}
        </button>

        <button
          onClick={onClose}
          className="block w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3 py-2"
        >
          나중에
        </button>
      </div>
    </div>
  );
}
