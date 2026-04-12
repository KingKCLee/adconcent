import { useState } from 'react';
import { Target, TrendingUp, Plus, Lock, Globe, Activity, Calendar, BarChart3 } from 'lucide-react';
import { CURRENT_PLAN } from '@/lib/plans';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';

type BidStatus = '입찰실행' | '입찰대기' | '목표달성' | '하향입찰' | '최대입찰가도달';

interface KeywordRow {
  keyword: string;
  product: string;
  currentRank: number;
  targetRank: number;
  currentBid: number;
  aiBid: number;
  status: BidStatus;
  inProgress: number;
  pending: number;
  achieved: number;
  lowered: number;
}

// 임시 키워드 데이터 (실제로는 D1 bid_settings + Worker /naver 응답)
const sampleKeywords: KeywordRow[] = [
  { keyword: '송도분양', product: '파워링크', currentRank: 2, targetRank: 3, currentBid: 380, aiBid: 200, status: '하향입찰', inProgress: 0, pending: 0, achieved: 1, lowered: 1 },
  { keyword: '송도아파트분양', product: '파워링크', currentRank: 3, targetRank: 3, currentBid: 290, aiBid: 290, status: '목표달성', inProgress: 0, pending: 0, achieved: 1, lowered: 0 },
  { keyword: '송도1군구분양', product: '파워링크', currentRank: 1, targetRank: 3, currentBid: 380, aiBid: 260, status: '하향입찰', inProgress: 0, pending: 0, achieved: 0, lowered: 1 },
  { keyword: '송도잔여세대', product: '파워링크', currentRank: 5, targetRank: 3, currentBid: 260, aiBid: 1890, status: '입찰실행', inProgress: 1, pending: 0, achieved: 0, lowered: 0 },
  { keyword: '송도할인분양', product: '파워링크', currentRank: 7, targetRank: 3, currentBid: 670, aiBid: 1890, status: '입찰대기', inProgress: 0, pending: 1, achieved: 0, lowered: 0 },
];

const statusStyles: Record<BidStatus, string> = {
  '입찰실행': 'bg-blue-50 text-blue-600 border-blue-200',
  '입찰대기': 'bg-amber-50 text-amber-600 border-amber-200',
  '목표달성': 'bg-green-50 text-green-600 border-green-200',
  '하향입찰': 'bg-gray-50 text-gray-600 border-gray-200',
  '최대입찰가도달': 'bg-red-50 text-red-600 border-red-200',
};

export function AutoBidPage() {
  const isFree = CURRENT_PLAN === 'free';
  const isConnected = true; // 임시: 데모용 키워드 표시
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleAdd = () => {
    if (isFree) { setShowUpgrade(true); return; }
    // TODO: 키워드 추가 다이얼로그
  };

  const kpis = [
    { label: '목표 적중률', icon: Target, color: 'text-green-600', bg: 'bg-green-50', value: '60%', sub: `${sampleKeywords.length}개 중 3개 달성` },
    { label: '관리 키워드', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', value: `${sampleKeywords.length}개`, sub: '자동입찰 대상' },
  ];

  return (
    <div className="space-y-6">
      {/* 서비스 이용 현황 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-900 text-sm">서비스 이용 현황</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          <div className="px-5 py-4 flex items-center gap-3">
            <Globe className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">사이트</p>
              <p className="text-sm font-semibold text-gray-900">hitbunyang</p>
            </div>
          </div>
          <div className="px-5 py-4 flex items-center gap-3">
            <Activity className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-xs text-gray-500">타입</p>
              <p className="text-sm font-semibold text-green-700">라이브</p>
            </div>
          </div>
          <div className="px-5 py-4 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">사용량</p>
              <p className="text-sm font-semibold text-gray-900">0건</p>
            </div>
          </div>
          <div className="px-5 py-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">기간</p>
              <p className="text-sm font-semibold text-gray-900">13일 남음</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {kpis.map(({ label, icon: Icon, color, bg, value, sub }) => (
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

      {/* 키워드 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">키워드 자동입찰 목록</h3>
            {isFree && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Starter부터 사용 가능
              </span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3 h-3" />
            키워드 추가
          </button>
        </div>

        {isFree ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-50 to-violet-50 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 mb-2">자동입찰은 Starter 플랜부터 사용할 수 있습니다</h4>
            <p className="text-sm text-gray-500 mb-6">
              지금 업그레이드하면 키워드 50개까지 24시간 자동 관리됩니다.<br />
              CPA 목표 기반으로 AI가 입찰가를 최적화합니다.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Starter로 업그레이드
            </button>
          </div>
        ) : !isConnected ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <h4 className="text-base font-semibold text-gray-900 mb-2">네이버 광고 계정 연결이 필요합니다</h4>
            <p className="text-sm text-gray-500 mb-6">계정을 연결하면 키워드가 자동으로 불러와지고<br />AI가 입찰가를 최적화합니다.</p>
            <a href="/dashboard/settings" className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              네이버 계정 연결하기
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">키워드</th>
                  <th className="px-3 py-3 font-medium">광고상품</th>
                  <th className="px-3 py-3 font-medium text-center">현재순위</th>
                  <th className="px-3 py-3 font-medium text-center">목표순위</th>
                  <th className="px-3 py-3 font-medium text-right">현재입찰가</th>
                  <th className="px-3 py-3 font-medium text-right">AI추천</th>
                  <th className="px-3 py-3 font-medium text-center">상태</th>
                  <th className="px-3 py-3 font-medium text-center">입찰실행</th>
                  <th className="px-3 py-3 font-medium text-center">입찰대기</th>
                  <th className="px-3 py-3 font-medium text-center">목표달성</th>
                  <th className="px-3 py-3 font-medium text-center">하향입찰</th>
                  <th className="px-3 py-3 font-medium text-center">액션</th>
                </tr>
              </thead>
              <tbody>
                {sampleKeywords.map((kw, i) => {
                  const delta = kw.aiBid - kw.currentBid;
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{kw.keyword}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{kw.product}</td>
                      <td className="px-3 py-3 text-center font-medium text-gray-700">{kw.currentRank}위</td>
                      <td className="px-3 py-3 text-center text-gray-500">{kw.targetRank}위</td>
                      <td className="px-3 py-3 text-right text-gray-700">{kw.currentBid.toLocaleString()}원</td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-semibold text-gray-900">{kw.aiBid.toLocaleString()}원</span>
                        {delta !== 0 && (
                          <span className={`ml-1 text-[10px] ${delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            ({delta > 0 ? '+' : ''}{delta})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[10px] font-medium px-2 py-1 rounded-full border ${statusStyles[kw.status]}`}>
                          {kw.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-700">{kw.inProgress}</td>
                      <td className="px-3 py-3 text-center text-gray-700">{kw.pending}</td>
                      <td className="px-3 py-3 text-center text-gray-700">{kw.achieved}</td>
                      <td className="px-3 py-3 text-center text-gray-700">{kw.lowered}</td>
                      <td className="px-3 py-3 text-center">
                        <button className="text-xs text-blue-600 hover:underline">설정</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUpgrade && (
        <UpgradePrompt
          feature="자동입찰"
          description="자동입찰은 Starter 플랜부터 사용할 수 있습니다. 지금 업그레이드하면 키워드 50개까지 24시간 자동 관리됩니다."
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}
