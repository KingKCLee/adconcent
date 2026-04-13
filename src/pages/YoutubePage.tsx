import { Play, Sparkles, Eye, Clock, ShieldCheck, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlan } from '@/hooks/usePlan';

export function YoutubePage() {
  const { plan } = usePlan();
  const locked = plan === 'free' || plan === 'starter';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-gradient-to-br from-red-50 via-white to-orange-50 rounded-xl border border-gray-200 p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-bold text-gray-900">YouTube · Google Ads</h2>
              <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                Pro
              </span>
            </div>
            <p className="text-sm text-gray-600">
              YouTube 동영상 광고와 Google Ads 캠페인을 통합 관리하고 AI 최적 노출 시간대를 추천받으세요.
            </p>
          </div>
          {locked ? (
            <Link
              to="/dashboard/billing"
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Pro 플랜으로 업그레이드
            </Link>
          ) : (
            <button
              disabled
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold opacity-60 cursor-not-allowed"
            >
              Google Ads 연결 (준비 중)
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mb-3">
            <Play className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">동영상 광고 성과</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            조회율 · 클릭율 · 평균 시청 시간을 한 화면에서 비교합니다.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">AI 최적 노출 시간대</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            과거 성과를 분석해 노출 효율이 가장 높은 요일·시간대를 추천합니다.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">부정클릭 차단 통합</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            네이버에서 차단한 IP가 Google Ads 광고에서도 자동 제외됩니다.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="w-4 h-4 text-red-600" /> 동영상 캠페인 미리보기
          </h3>
          <span className="text-[10px] font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded-full">PREVIEW</span>
        </div>
        <div className="p-8 text-center text-xs text-gray-400">
          Google Ads 계정 연결 후 동영상 캠페인 성과가 여기에 표시됩니다.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-gray-900">AI 노출 시간대 분석</h3>
          <span className="text-[10px] font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded-full">PREVIEW</span>
        </div>
        <div className="text-center text-xs text-gray-400 py-8">
          광고 데이터가 수집되면 시간대별 효율 차트가 표시됩니다.
        </div>
      </div>
    </div>
  );
}
