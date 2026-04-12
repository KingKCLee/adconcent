import { Target, TrendingUp, Plus } from 'lucide-react';

export function AutoBidPage() {
  const isConnected = false; // TODO: 네이버 계정 연결 상태

  const kpis = [
    { label: '목표 적중률', icon: Target, color: 'text-green-600', bg: 'bg-green-50', value: '- %', sub: '연결 후 측정' },
    { label: '관리 키워드', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', value: '0개', sub: '자동입찰 대상' },
  ];

  return (
    <div className="space-y-6">
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

      {/* Keyword table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">키워드 자동입찰 목록</h3>
          {isConnected && (
            <button className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-3 h-3" />
              키워드 추가
            </button>
          )}
        </div>

        {!isConnected ? (
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
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">키워드</th>
                  <th className="px-5 py-3 font-medium">현재 순위</th>
                  <th className="px-5 py-3 font-medium">목표 순위</th>
                  <th className="px-5 py-3 font-medium">현재 입찰가</th>
                  <th className="px-5 py-3 font-medium">AI 추천 입찰가</th>
                  <th className="px-5 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">키워드가 없습니다</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
