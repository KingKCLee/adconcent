import { Link } from 'react-router-dom';
import { Shield, Zap, BarChart3, Bot, ArrowRight, Check, Sparkles } from 'lucide-react';

const stats = [
  { value: '99.2%', label: '부정클릭 차단율' },
  { value: '23%', label: '평균 광고비 절감' },
  { value: '98.3%', label: '자동입찰 목표 적중률' },
];

const features = [
  {
    icon: Shield,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    title: '부정클릭 AI 차단',
    desc: 'IP 변조까지 탐지하는 AI 엔진. 의심 IP를 자동으로 네이버에 신고하여 광고비를 보호합니다.',
  },
  {
    icon: Zap,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    title: '24시간 자동입찰',
    desc: 'CPA 목표 기반 AI 입찰가 최적화. 키워드별 경쟁 상황을 실시간 반영하여 입찰가를 조정합니다.',
  },
  {
    icon: BarChart3,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    title: '멀티매체 통합',
    desc: '네이버·구글·Meta 광고를 한 화면에서 통합 관리. 업계 유일의 멀티 플랫폼 통합 분석.',
  },
  {
    icon: Bot,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    title: 'AI 주간 리포트',
    desc: '매주 월요일 오전 9시, Claude AI가 분석한 성과 리포트를 이메일로 자동 발송합니다.',
  },
];

const plans = [
  {
    name: 'Starter',
    price: '9,900',
    desc: '소규모 광고주 시작용',
    features: ['IP 차단 무제한', 'AI 분석 월 30회', '자동입찰 키워드 50개', '환급 CSV 다운로드'],
    highlighted: false,
  },
  {
    name: 'Growth',
    price: '24,900',
    desc: '성장 중인 비즈니스',
    badge: '가장 인기',
    features: ['Starter 전부 포함', '구글 광고 연동', '키워드 자동 확장', 'AI 주간 리포트'],
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '49,900',
    desc: '대규모·대행사용',
    features: ['Growth 전부 포함', 'Meta · YouTube 연동', 'AI 분석 무제한', '다중 사이트 (5개)'],
    highlighted: false,
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/50 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50" />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/5 backdrop-blur-sm mb-8">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300 font-medium">AI 기반 광고 자동화</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            광고비를 <span className="gradient-text">지키고</span><br />
            성과를 높이세요
          </h1>

          {/* Sub */}
          <p className="text-lg md:text-xl text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            AI가 부정클릭을 실시간 차단하고,<br className="md:hidden" />
            입찰가를 24시간 자동 최적화합니다.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-semibold transition-all glow-blue hover:scale-105"
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 border border-white/15 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-white px-8 py-4 rounded-full font-semibold transition-colors"
            >
              데모 보기
            </a>
          </div>

          <p className="text-sm text-gray-500">이미 250+ 광고주가 사용 중</p>
        </div>
      </section>

      {/* Stats */}
      <section className="relative py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Features */}
      <section id="features" className="relative py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              경쟁사가 없는 <span className="gradient-text">기능들</span>
            </h2>
            <p className="text-gray-400 text-lg">광고비 절감과 성과 최적화를 동시에</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map(({ icon: Icon, color, bg, title, desc }) => (
              <div
                key={title}
                className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-2xl p-8 backdrop-blur-sm transition-all"
              >
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-5`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <h3 className="text-xl font-semibold mb-3">{title}</h3>
                <p className="text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              명확한 <span className="gradient-text">요금제</span>
            </h2>
            <p className="text-gray-400 text-lg">광고 규모에 맞는 플랜을 선택하세요</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 backdrop-blur-sm transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-to-b from-blue-500/10 to-violet-500/5 border-2 border-blue-500/50 glow-blue'
                    : 'bg-white/[0.03] border border-white/10 hover:border-white/20'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mb-5">{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-gray-500">원/월</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlighted ? 'text-blue-400' : 'text-gray-500'}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/signup"
                  className={`block text-center w-full py-3 rounded-xl font-semibold transition-all ${
                    plan.highlighted
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}
                >
                  시작하기
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-black/40 border-t border-white/5 py-12 mt-16 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">A</span>
              </div>
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
