import { Link } from 'react-router-dom';
import { Shield, TrendingUp, BarChart3, Zap, Check, Sparkles } from 'lucide-react';

const features = [
  { icon: Shield, title: '부정클릭 차단', desc: 'AI가 실시간으로 부정클릭을 탐지하고 자동으로 IP를 차단합니다.' },
  { icon: TrendingUp, title: '자동 입찰', desc: '목표 CPA에 맞춰 키워드별 입찰가를 자동으로 최적화합니다.' },
  { icon: BarChart3, title: '성과 분석', desc: '클릭, 전환, 비용을 한눈에 파악하고 AI 인사이트를 제공합니다.' },
  { icon: Zap, title: '실시간 보호', desc: '10분마다 의심 IP를 집계하여 네이버 광고에 자동 반영합니다.' },
];

const plans = [
  {
    name: 'Starter',
    price: '9,900',
    color: 'blue',
    features: ['IP 차단 무제한', 'AI 분석 월 30회', '자동입찰 키워드 50개', '환급 CSV 다운로드'],
  },
  {
    name: 'Growth',
    price: '24,900',
    color: 'violet',
    badge: '추천',
    features: ['Starter 전부 포함', '구글 광고 연동', '키워드 자동 확장', 'AI 주간 리포트'],
  },
  {
    name: 'Pro',
    price: '49,900',
    color: 'gray',
    features: ['Growth 전부 포함', 'Meta · YouTube 연동', 'AI 분석 무제한', '다중 사이트 (5개)'],
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-600">AdConcent</h1>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">로그인</Link>
            <Link to="/signup" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">무료 시작</Link>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          네이버 검색광고<br />부정클릭 차단 & 자동 최적화
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          AI가 부정클릭을 실시간 탐지하고, 입찰가를 자동 최적화합니다.
        </p>
        <Link to="/signup" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700">
          7일 무료 체험 시작
        </Link>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
              <Icon className="w-10 h-10 text-blue-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-16 border-t border-gray-100">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">요금제</h2>
          <p className="text-gray-600">광고 규모에 맞는 플랜을 선택하세요</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isHighlighted = plan.color === 'violet';
            return (
              <div
                key={plan.name}
                className={`bg-white rounded-xl p-7 relative ${
                  isHighlighted ? 'border-2 border-violet-500 shadow-lg' : 'border border-gray-200'
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
                <div className="mb-5">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h4>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-sm text-gray-500">원/월</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${
                        plan.color === 'violet' ? 'text-violet-600' :
                        plan.color === 'blue' ? 'text-blue-600' :
                        'text-gray-600'
                      }`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block text-center w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                    plan.color === 'violet' ? 'bg-violet-600 text-white hover:bg-violet-700' :
                    plan.color === 'blue' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  무료로 시작하기
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="bg-[#0F172A] py-12 mt-16">
        <div className="max-w-6xl mx-auto px-6">
          {/* 상단 — 브랜드 */}
          <div className="text-center mb-6">
            <p className="text-lg font-semibold text-white mb-1">AdConcent</p>
            <p className="text-sm text-gray-400">AI 검색광고 자동화 플랫폼</p>
          </div>

          {/* 중단 — 링크 */}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-8">
            <Link to="/terms" className="hover:text-gray-300 transition-colors">이용약관</Link>
            <span className="text-gray-700">|</span>
            <Link to="/privacy" className="hover:text-gray-300 transition-colors">개인정보처리방침</Link>
          </div>

          {/* 하단 — 사업자 정보 (작고 흐리게) */}
          <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-600 leading-relaxed space-y-1">
            <p>더블유부동산공인중개사사무소 | 대표 이광철 | 사업자등록번호 589-24-01721 | 통신판매업 제2025-인천부평-0992호</p>
            <p>인천광역시 부평구 경원대로1344번길 34, 2층 256호 | 대표전화 1533-9077</p>
            <p className="pt-2">&copy; 2026 AdConcent. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
