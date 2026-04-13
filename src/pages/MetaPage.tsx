import { Globe, Sparkles, Users, Target, ShieldCheck, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlan } from '@/hooks/usePlan';

export function MetaPage() {
  const { plan } = usePlan();
  const locked = plan === 'free' || plan === 'starter';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-violet-50 rounded-xl border border-gray-200 p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900">Meta 광고 (Facebook · Instagram)</h2>
              <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                Pro
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Facebook, Instagram 광고를 한 화면에서 통합 관리하고 AI 타겟팅을 받아보세요.
            </p>
          </div>
          {locked ? (
            <Link
              to="/dashboard/billing"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Pro 플랜으로 업그레이드
            </Link>
          ) : (
            <button
              disabled
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold opacity-60 cursor-not-allowed"
            >
              Meta 계정 연결 (준비 중)
            </button>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">캠페인 통합 관리</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Facebook · Instagram 광고세트와 광고를 단일 대시보드에서 조회하고 예산을 조정합니다.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-violet-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">AI 타겟팅 추천</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            연령 · 성별 · 관심사를 분석해 최적 타겟 그룹과 입찰 전략을 제안합니다.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">부정클릭 차단 통합</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            네이버에서 차단한 의심 IP가 Meta 광고에서도 자동으로 제외됩니다.
          </p>
        </div>
      </div>

      {/* Mock preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">캠페인 미리보기</h3>
          <span className="text-[10px] font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded-full">PREVIEW</span>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-center text-xs text-gray-400 py-8">
            Meta 계정 연결 후 실제 캠페인 데이터가 여기에 표시됩니다.
          </div>
        </div>
      </div>

      {/* Audience preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-gray-900">AI 추천 타겟 그룹</h3>
          <span className="text-[10px] font-medium px-2 py-1 bg-gray-100 text-gray-500 rounded-full">PREVIEW</span>
        </div>
        <div className="text-center text-xs text-gray-400 py-8">
          Meta 광고 데이터가 수집되면 AI가 최적 타겟 그룹을 추천합니다.
        </div>
      </div>
    </div>
  );
}
