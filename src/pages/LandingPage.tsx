import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Sparkles,
  ShieldOff,
  Clock,
  BarChart,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

const problems = [
  {
    emoji: '😤',
    title: '광고비는 나가는데 전화·주문·예약이 없다',
    desc: '클릭은 되는데 실제 고객이 아닌 봇이나 경쟁사 직원이 클릭하고 있을 수 있습니다. 부정클릭은 광고비를 낭비하고 광고 품질지수까지 낮춥니다. 병원·쇼핑몰·부동산·음식점 할 것 없이 모두 피해를 입습니다.',
  },
  {
    emoji: '😰',
    title: '경쟁사는 항상 상위에 있는데 나는 밀린다',
    desc: '경쟁사는 자동입찰 솔루션으로 24시간 순위를 관리합니다. 수동으로 하루 한 번 확인하는 동안 이미 수십 번 밀려납니다.',
  },
  {
    emoji: '😱',
    title: '광고비를 올려도 성과가 안 나온다',
    desc: '키워드별 최적 입찰가를 모르면 돈만 낭비합니다. 너무 낮으면 노출이 안 되고, 너무 높으면 수익이 없습니다.',
  },
];

const causes = [
  {
    icon: ShieldOff,
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
    border: 'border-red-500/20',
    title: '부정클릭 — 광고비의 평균 15~30%가 낭비됩니다',
    desc: '경쟁사, 봇, 클릭 농장이 하루 수십 번 클릭합니다. 전화·주문·예약은 없는데 클릭비용만 나갑니다. 네이버는 사후 환급을 해주지만 기준이 까다롭고 이미 품질지수는 떨어진 후입니다.',
  },
  {
    icon: Clock,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    title: '수동 입찰 — 잠자는 사이 경쟁사에 밀립니다',
    desc: '광고 경매는 24시간 진행됩니다. 아침에 확인하고 저녁에 조정하는 동안 경쟁사 자동입찰 시스템은 10분마다 최적화합니다.',
  },
  {
    icon: BarChart,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    title: '비효율 키워드 — 노출 0회 키워드에 돈이 나갑니다',
    desc: '전체 키워드의 30~40%는 노출조차 안 됩니다. 그런데 입찰가는 계속 나갑니다. 이걸 모르면 매달 수십만원이 증발합니다.',
  },
];

const solutions = [
  {
    icon: ShieldCheck,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    ring: 'ring-blue-500/30',
    title: 'AI 부정클릭 실시간 차단',
    items: [
      '의심 IP 실시간 탐지',
      '동일 IP 반복클릭 자동 차단',
      '네이버 광고시스템에 즉시 반영',
      '월간 절감 리포트 자동 발송',
    ],
  },
  {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/30',
    title: '24시간 자동입찰 최적화',
    items: [
      '10분마다 현재 순위 확인',
      '목표 순위에 맞게 자동 입찰가 조정',
      '최대 입찰가 초과 방지',
      '시간대별 입찰 전략 적용',
    ],
  },
  {
    icon: Sparkles,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    ring: 'ring-violet-500/30',
    title: 'AI 광고 성과 분석',
    items: [
      '비효율 키워드 자동 감지',
      '광고비 낭비 구간 분석',
      'AI 입찰가 조정 제안',
      '매주 월요일 자동 리포트',
    ],
  },
];

const stats = [
  { value: '99.2%', label: '부정클릭 차단율' },
  { value: '23%', label: '평균 광고비 절감' },
  { value: '98.3%', label: '자동입찰 적중률' },
  { value: '3분', label: '평균 설치 시간' },
];

const plans = [
  {
    name: 'Free',
    price: '0',
    desc: '지금 바로 시작',
    features: [
      '부정클릭 탐지 (무제한)',
      'IP 차단 월 3개',
      'AI 분석 월 1회',
      '클릭 로그 3일 보관',
    ],
    cta: '무료로 시작',
    badge: '신용카드 불필요',
    style: 'free',
  },
  {
    name: 'Starter',
    price: '9,900',
    desc: '소규모 광고주',
    features: [
      'IP 차단 무제한',
      'AI 분석 월 30회',
      '자동입찰 키워드 50개',
      '환급 CSV 다운로드',
    ],
    cta: '시작하기',
    style: 'normal',
  },
  {
    name: 'Growth',
    price: '24,900',
    desc: '성장 중인 비즈니스',
    badge: '가장 인기',
    features: [
      'Starter 전부 포함',
      '구글 광고 연동',
      '키워드 자동 확장',
      'AI 주간 리포트',
    ],
    cta: '시작하기',
    style: 'highlight',
  },
  {
    name: 'Pro',
    price: '49,900',
    desc: '대규모·대행사용',
    features: [
      'Growth 전부 포함',
      'Meta · YouTube 연동',
      'AI 분석 무제한',
      '다중 사이트 (5개)',
    ],
    cta: '시작하기',
    style: 'normal',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/50 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="A" width={32} height={32} className="w-8 h-8 rounded-lg" />
            <span className="text-white font-semibold text-lg">AdConcent</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">로그인</Link>
            <Link to="/signup" className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              무료 시작
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(37,99,235,0.15) 0%, transparent 70%), #0A0A0F',
        }}
      >
        <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50" />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/5 backdrop-blur-sm mb-8">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300 font-medium">✦ 네이버 광고 자동화 솔루션</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            광고비는 나가는데<br />
            전화·주문·예약이 <span className="gradient-text">안 오는 이유</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            부정클릭이 광고비를 갉아먹고, 경쟁사는 자동으로 순위를 올립니다.<br className="hidden md:block" />
            AdConcent가 24시간 지켜드립니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-semibold transition-all glow-blue hover:scale-105"
            >
              무료로 시작하기 (신용카드 불필요)
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <p className="text-sm text-gray-500">⚡ 3분 만에 설치</p>
        </div>
      </section>

      {/* 2. Problem */}
      <section className="relative py-24 bg-[#0F172A]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              혹시 이런 경험 <span className="gradient-text">있으신가요?</span>
            </h2>
            <p className="text-gray-400 text-lg">
              네이버 광고를 운영하는 광고주 10명 중 8명이 이 문제를 겪고 있습니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {problems.map((p) => (
              <div
                key={p.title}
                className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-2xl p-8 backdrop-blur-sm transition-all"
              >
                <div className="text-5xl mb-5">{p.emoji}</div>
                <h3 className="text-xl font-semibold mb-3 leading-snug">"{p.title}"</h3>
                <p className="text-gray-400 leading-relaxed text-sm">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Causes */}
      <section className="relative py-24 bg-[#0A0A0F]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              당신의 광고비가 새는 <span className="gradient-text">3가지 구멍</span>
            </h2>
          </div>

          <div className="space-y-6">
            {causes.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className={`flex flex-col md:flex-row items-start gap-6 bg-white/[0.03] border ${c.border} rounded-2xl p-8 backdrop-blur-sm`}
                >
                  <div className={`w-16 h-16 shrink-0 rounded-2xl ${c.iconBg} flex items-center justify-center`}>
                    <Icon className={`w-8 h-8 ${c.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-semibold mb-3 leading-snug">{c.title}</h3>
                    <p className="text-gray-400 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Solutions */}
      <section className="relative py-24 bg-[#0F172A]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              AdConcent가 <span className="gradient-text">이렇게 해결합니다</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {solutions.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className={`bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:ring-2 hover:${s.ring} rounded-2xl p-8 backdrop-blur-sm transition-all`}
                >
                  <div className={`w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center mb-5`}>
                    <Icon className={`w-7 h-7 ${s.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-5 leading-snug">{s.title}</h3>
                  <ul className="space-y-3">
                    {s.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${s.color}`} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="relative py-24 bg-[#0A0A0F]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              모든 업종에서 <span className="gradient-text">효과를 검증했습니다</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { emoji: '🏥', name: '병원·의원', desc: '예약 없는 클릭 차단 + 시술 키워드 자동 순위 관리' },
              { emoji: '🏠', name: '부동산·분양', desc: '분양 문의 늘리기 + 경쟁 단지 대비 노출 우위 확보' },
              { emoji: '🛍', name: '쇼핑몰·이커머스', desc: '구매 전환 없는 클릭 제거 + 상품 키워드 최적 입찰' },
              { emoji: '🍽', name: '음식점·서비스업', desc: '예약·주문 늘리기 + 지역 키워드 상위 노출 유지' },
            ].map((i) => (
              <div
                key={i.name}
                className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-2xl p-7 backdrop-blur-sm transition-all"
              >
                <div className="text-4xl mb-4">{i.emoji}</div>
                <h3 className="text-lg font-semibold mb-2">{i.name}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{i.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Stats */}
      <section className="relative py-20 bg-gradient-to-r from-blue-900 to-purple-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-center backdrop-blur-sm"
              >
                <p className="text-4xl md:text-5xl font-bold gradient-text mb-2">{s.value}</p>
                <p className="text-sm text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Pricing */}
      <section className="relative py-24 bg-[#0F172A]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              명확한 <span className="gradient-text">요금제</span>
            </h2>
            <p className="text-gray-400 text-lg">무료로 시작해서 필요할 때 업그레이드하세요</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => {
              const isFree = plan.style === 'free';
              const isHighlight = plan.style === 'highlight';
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-7 backdrop-blur-sm transition-all ${
                    isHighlight
                      ? 'bg-gradient-to-b from-blue-500/10 to-violet-500/5 border-2 border-blue-500/50 glow-blue'
                      : isFree
                      ? 'bg-gradient-to-b from-blue-500/15 to-blue-500/[0.02] border-2 border-blue-400/40'
                      : 'bg-white/[0.03] border border-white/10 hover:border-white/20'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className={`text-white text-xs font-bold px-3 py-1 rounded-full ${
                        isFree
                          ? 'bg-blue-500'
                          : 'bg-gradient-to-r from-blue-500 to-violet-600'
                      }`}>
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mb-5">{plan.desc}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-gray-500">원/월</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                          isHighlight ? 'text-blue-400' : isFree ? 'text-blue-300' : 'text-gray-500'
                        }`} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/signup"
                    className={`block text-center w-full py-3 rounded-xl font-semibold transition-all ${
                      isHighlight || isFree
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Final CTA */}
      <section className="relative py-24 overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="absolute inset-0 grid-pattern opacity-10" />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            지금 바로 시작하세요
          </h2>
          <p className="text-lg md:text-xl text-blue-100 mb-10">
            3분 설치 · 신용카드 불필요 · 언제든 업그레이드
          </p>

          <Link
            to="/signup"
            className="group inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-blue-700 px-10 py-5 rounded-full text-lg font-bold transition-all hover:scale-105 shadow-2xl"
          >
            무료로 시작하기
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <p className="mt-8 text-sm text-blue-200">
            병원·쇼핑몰·부동산·음식점 광고주들이 매달 평균 23% 광고비를 절감하고 있습니다
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-[#020209] border-t border-white/5 py-12 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2.5 mb-2">
              <img src="/logo.svg" alt="A" width={28} height={28} className="w-7 h-7 rounded-lg" />
              <p className="text-lg font-semibold text-white">AdConcent</p>
            </div>
            <p className="text-sm text-gray-400">AI 검색광고 자동화 플랫폼</p>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-8">
            <Link to="/terms" className="hover:text-gray-300 transition-colors">이용약관</Link>
            <span className="text-gray-700">|</span>
            <Link to="/privacy" className="hover:text-gray-300 transition-colors">개인정보처리방침</Link>
          </div>

          <div className="border-t border-white/5 pt-6 text-center text-xs text-gray-600 leading-relaxed space-y-1">
            <p>더블유부동산공인중개사사무소 | 대표 이광철 | 사업자등록번호 589-24-01721 | 통신판매업 제2025-인천부평-0992호</p>
            <p>인천광역시 부평구 경원대로1344번길 34, 2층 256호 | 대표전화 1533-9077</p>
            <p className="pt-2">&copy; 2026 AdConcent. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
