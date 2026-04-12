import { Link } from 'react-router-dom';
import { Shield, TrendingUp, BarChart3, Zap } from 'lucide-react';

const features = [
  { icon: Shield, title: '부정클릭 차단', desc: 'AI가 실시간으로 부정클릭을 탐지하고 자동으로 IP를 차단합니다.' },
  { icon: TrendingUp, title: '자동 입찰', desc: '목표 CPA에 맞춰 키워드별 입찰가를 자동으로 최적화합니다.' },
  { icon: BarChart3, title: '성과 분석', desc: '클릭, 전환, 비용을 한눈에 파악하고 AI 인사이트를 제공합니다.' },
  { icon: Zap, title: '실시간 보호', desc: '10분마다 의심 IP를 집계하여 네이버 광고에 자동 반영합니다.' },
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

      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-500">
        &copy; 2026 AdConcent. All rights reserved.
      </footer>
    </div>
  );
}
