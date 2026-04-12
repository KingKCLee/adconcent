import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, TrendingUp, Target, BarChart3, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { getRelatedKeywords, type RelatedKeyword } from '@/lib/naverApi';
import { supabase } from '@/lib/supabase';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface Props { adAccountId: string | undefined }

type TabKey = 'discover' | 'quality' | 'rank';

interface QualityRow {
  ncc_keyword_id: string;
  keyword: string;
  ad_relevance_score: number | null;
  expected_click_score: number | null;
  qi_grade: number | null;
  bid_amt: number | null;
}

interface CompetitorRow {
  keyword: string;
  rank1: number;
  ourBid: number;
  gap: number;
}

interface RankSeries {
  keyword: string;
  points: { date: string; rank: number }[];
  first: number;
  last: number;
  trend: 'up' | 'down' | 'flat';
}

function gradeLabel(monthlyTotal: number, compIdx: string) {
  if (monthlyTotal >= 3000 && compIdx === '높음') return { grade: 'S', color: 'text-red-600 bg-red-50 border-red-200' };
  if (monthlyTotal >= 1000 && (compIdx === '높음' || compIdx === '중간')) return { grade: 'A', color: 'text-orange-600 bg-orange-50 border-orange-200' };
  if (monthlyTotal >= 300) return { grade: 'B', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  return { grade: 'C', color: 'text-gray-500 bg-gray-50 border-gray-200' };
}

export default function KeywordStrategy({ adAccountId }: Props) {
  const [tab, setTab] = useState<TabKey>('discover');

  // ===== 1) 키워드 발굴 =====
  const [query, setQuery] = useState('');
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [results, setResults] = useState<RelatedKeyword[]>([]);

  const handleDiscover = async () => {
    if (!adAccountId || !query.trim()) return;
    setDiscoverLoading(true);
    try {
      const rows = await getRelatedKeywords(adAccountId, query.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5));
      setResults(rows);
    } finally { setDiscoverLoading(false); }
  };

  // ===== 2) 품질 분석 + 경쟁사 현황 =====
  const [qualityRows, setQualityRows] = useState<QualityRow[]>([]);
  const [competitorRows, setCompetitorRows] = useState<CompetitorRow[]>([]);
  const [qualityLoading, setQualityLoading] = useState(false);

  const loadQuality = useCallback(async () => {
    if (!adAccountId) return;
    setQualityLoading(true);
    try {
      const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const [qRes, cRes, kwRes] = await Promise.all([
        supabase.from('keyword_quality')
          .select('ncc_keyword_id, keyword, ad_relevance_score, expected_click_score, qi_grade, bid_amt, created_at')
          .gte('created_at', since24)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('competitor_bids')
          .select('keyword, bids, created_at')
          .gte('created_at', since24)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('ad_keyword_settings')
          .select('keyword, max_bid')
          .eq('ad_account_id', adAccountId),
      ]);

      // 품질: 키워드별 최신 row 만
      const qMap: Record<string, QualityRow> = {};
      for (const r of (qRes.data || [])) {
        if (!r.ncc_keyword_id || qMap[r.ncc_keyword_id]) continue;
        qMap[r.ncc_keyword_id] = {
          ncc_keyword_id: r.ncc_keyword_id,
          keyword: r.keyword,
          ad_relevance_score: r.ad_relevance_score,
          expected_click_score: r.expected_click_score,
          qi_grade: r.qi_grade,
          bid_amt: r.bid_amt,
        };
      }
      const qList = Object.values(qMap)
        .sort((a, b) => (a.ad_relevance_score ?? 99) - (b.ad_relevance_score ?? 99));
      setQualityRows(qList);

      // 경쟁사: 키워드별 최신 1위 값 + 우리 max_bid
      const cMap: Record<string, number> = {};
      for (const r of (cRes.data || [])) {
        if (cMap[r.keyword] !== undefined) continue;
        const bids = (r.bids || {}) as Record<string, number>;
        const rank1 = bids['1'] || bids[1] || 0;
        if (rank1 > 0) cMap[r.keyword] = rank1;
      }
      const ourBidMap: Record<string, number> = {};
      for (const r of (kwRes.data || [])) {
        if (r.keyword && r.max_bid) ourBidMap[r.keyword] = r.max_bid;
      }
      const compList: CompetitorRow[] = Object.entries(cMap)
        .map(([keyword, rank1]) => ({
          keyword,
          rank1,
          ourBid: ourBidMap[keyword] || 0,
          gap: (ourBidMap[keyword] || 0) - rank1,
        }))
        .sort((a, b) => a.gap - b.gap);
      setCompetitorRows(compList);
    } finally {
      setQualityLoading(false);
    }
  }, [adAccountId]);

  // ===== 3) 순위 트렌드 =====
  const [rankSeries, setRankSeries] = useState<RankSeries[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const loadRank = useCallback(async () => {
    if (!adAccountId) return;
    setRankLoading(true);
    try {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase.from('rank_logs')
        .select('keyword, rank, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(3000);

      // 키워드별 시리즈 + 일자 평균
      const grouped: Record<string, { date: string; rank: number }[]> = {};
      for (const r of (data || [])) {
        if (!r.keyword || r.rank == null) continue;
        const date = r.created_at.slice(5, 10);
        (grouped[r.keyword] ||= []).push({ date, rank: r.rank });
      }
      const series: RankSeries[] = Object.entries(grouped).map(([keyword, pts]) => {
        // 일자별 평균
        const byDate: Record<string, { sum: number; n: number }> = {};
        for (const p of pts) {
          (byDate[p.date] ||= { sum: 0, n: 0 });
          byDate[p.date].sum += p.rank;
          byDate[p.date].n += 1;
        }
        const points = Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({ date, rank: Math.round(v.sum / v.n) }));
        const first = points[0]?.rank ?? 0;
        const last = points[points.length - 1]?.rank ?? 0;
        const diff = last - first;
        const trend: RankSeries['trend'] = diff < -0.5 ? 'up' : diff > 0.5 ? 'down' : 'flat';
        return { keyword, points, first, last, trend };
      });
      series.sort((a, b) => (a.last - b.last));
      setRankSeries(series);
      if (series.length > 0 && !selectedKeyword) setSelectedKeyword(series[0].keyword);
    } finally {
      setRankLoading(false);
    }
  }, [adAccountId, selectedKeyword]);

  useEffect(() => {
    if (tab === 'quality') loadQuality();
    if (tab === 'rank') loadRank();
  }, [tab, loadQuality, loadRank]);

  if (!adAccountId) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        설정 탭에서 광고 계정을 연결해주세요
      </div>
    );
  }

  const selectedSeries = rankSeries.find(s => s.keyword === selectedKeyword);

  return (
    <div className="h-full overflow-auto bg-gray-50 p-5">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* 탭 헤더 */}
        <div className="flex items-center gap-2">
          <TabBtn active={tab === 'discover'} onClick={() => setTab('discover')} icon={<Search className="w-4 h-4" />}>
            키워드 발굴
          </TabBtn>
          <TabBtn active={tab === 'quality'} onClick={() => setTab('quality')} icon={<Target className="w-4 h-4" />}>
            품질 분석
          </TabBtn>
          <TabBtn active={tab === 'rank'} onClick={() => setTab('rank')} icon={<BarChart3 className="w-4 h-4" />}>
            순위 트렌드
          </TabBtn>
        </div>

        {/* 1) 키워드 발굴 */}
        {tab === 'discover' && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-[#093687]" />
              <h3 className="text-sm font-bold text-gray-900">연관 키워드 발굴</h3>
              <span className="text-[11px] text-gray-500">네이버 keywordstool API · 최대 5개 힌트</span>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                placeholder="키워드 입력 (쉼표로 구분, 예: 송도분양, 월드메르디앙)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#093687]/30"
              />
              <button
                onClick={handleDiscover}
                disabled={discoverLoading || !query.trim()}
                className="px-4 py-2 bg-[#093687] text-white rounded text-sm font-medium hover:bg-[#0a3f9c] disabled:opacity-50 flex items-center gap-1"
              >
                {discoverLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                검색
              </button>
            </div>

            {results.length > 0 ? (
              <div className="overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">키워드</th>
                      <th className="text-center px-3 py-2 font-medium">등급</th>
                      <th className="text-right px-3 py-2 font-medium">월 PC</th>
                      <th className="text-right px-3 py-2 font-medium">월 모바일</th>
                      <th className="text-right px-3 py-2 font-medium">합계</th>
                      <th className="text-center px-3 py-2 font-medium">경쟁도</th>
                      <th className="text-right px-3 py-2 font-medium">예상 CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => {
                      const total = (r.monthlyPcQcCnt || 0) + (r.monthlyMobileQcCnt || 0);
                      const g = gradeLabel(total, r.compIdx);
                      const cpcPc = r.monthlyAvePcCtr > 0 && r.monthlyAvePcClkCnt > 0
                        ? Math.round((r.monthlyPcQcCnt * r.monthlyAvePcCtr / 100) / Math.max(r.monthlyAvePcClkCnt, 1))
                        : 0;
                      return (
                        <tr key={r.relKeyword} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800">{r.relKeyword}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${g.color}`}>{g.grade}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.monthlyPcQcCnt?.toLocaleString() || '-'}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.monthlyMobileQcCnt?.toLocaleString() || '-'}</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900">{total.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-[10px] ${r.compIdx === '높음' ? 'text-red-600' : r.compIdx === '중간' ? 'text-amber-600' : 'text-green-600'}`}>
                              {r.compIdx}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{cpcPc > 0 ? `${cpcPc.toLocaleString()}원` : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">키워드를 입력하고 검색하세요</p>
            )}
          </div>
        )}

        {/* 2) 품질 분석 + 경쟁사 현황 */}
        {tab === 'quality' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-gray-900">품질 분석 · 광고연관지수 낮은 순</h3>
                {qualityLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              </div>
              {qualityRows.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">품질 데이터 없음</p>
              ) : (
                <div className="overflow-auto max-h-[55vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium">키워드</th>
                        <th className="text-center px-2 py-1.5 font-medium">QI</th>
                        <th className="text-center px-2 py-1.5 font-medium">광고연관</th>
                        <th className="text-center px-2 py-1.5 font-medium">클릭기대</th>
                        <th className="text-left px-2 py-1.5 font-medium">가이드</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualityRows.slice(0, 50).map(r => {
                        const adRel = r.ad_relevance_score;
                        const expClk = r.expected_click_score;
                        const qi = r.qi_grade;
                        let guide = '-';
                        if (adRel != null && adRel < 4) guide = '소재 키워드 연관성 강화';
                        else if (expClk != null && expClk < 4) guide = '클릭 유도 문구 개선';
                        else if (qi != null && qi < 5) guide = '입찰가 상향 + 품질 점검';
                        else guide = '양호';
                        const relColor = adRel == null ? 'text-gray-400' : adRel >= 7 ? 'text-green-600' : adRel >= 4 ? 'text-amber-600' : 'text-red-600';
                        const clkColor = expClk == null ? 'text-gray-400' : expClk >= 7 ? 'text-green-600' : expClk >= 4 ? 'text-amber-600' : 'text-red-600';
                        const qiColor = qi == null ? 'text-gray-400' : qi >= 7 ? 'text-green-600' : qi >= 5 ? 'text-amber-600' : 'text-red-600';
                        return (
                          <tr key={r.ncc_keyword_id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1.5 text-gray-800 truncate max-w-[140px]">{r.keyword}</td>
                            <td className={`px-2 py-1.5 text-center font-bold ${qiColor}`}>{qi ?? '-'}</td>
                            <td className={`px-2 py-1.5 text-center ${relColor}`}>{adRel ?? '-'}/10</td>
                            <td className={`px-2 py-1.5 text-center ${clkColor}`}>{expClk ?? '-'}/10</td>
                            <td className="px-2 py-1.5 text-gray-600 truncate max-w-[160px]">{guide}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-[#093687]" />
                <h3 className="text-sm font-bold text-gray-900">경쟁사 입찰가 현황</h3>
              </div>
              {competitorRows.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">경쟁사 데이터 없음</p>
              ) : (
                <div className="overflow-auto max-h-[55vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium">키워드</th>
                        <th className="text-right px-2 py-1.5 font-medium">경쟁사 1위</th>
                        <th className="text-right px-2 py-1.5 font-medium">우리</th>
                        <th className="text-right px-2 py-1.5 font-medium">격차</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitorRows.slice(0, 50).map(r => {
                        const short = r.gap < 0;
                        return (
                          <tr key={r.keyword} className={`border-b border-gray-100 hover:bg-gray-50 ${short ? 'bg-red-50/30' : ''}`}>
                            <td className="px-2 py-1.5 text-gray-800 truncate max-w-[140px]">{r.keyword}</td>
                            <td className="px-2 py-1.5 text-right text-gray-700">{r.rank1.toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-right text-gray-700">{r.ourBid.toLocaleString()}</td>
                            <td className={`px-2 py-1.5 text-right font-bold ${short ? 'text-red-600' : 'text-emerald-600'}`}>
                              {r.gap > 0 ? '+' : ''}{r.gap.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-gray-500 mt-2">🔴 격차 음수 = 경쟁사 대비 우리 입찰가 부족</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3) 순위 트렌드 */}
        {tab === 'rank' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-[#093687]" />
                <h3 className="text-sm font-bold text-gray-900">키워드 순위 (7일)</h3>
                {rankLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              </div>
              {rankSeries.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">순위 데이터 없음</p>
              ) : (
                <div className="overflow-auto max-h-[55vh]">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium">키워드</th>
                        <th className="text-center px-2 py-1.5 font-medium">현재</th>
                        <th className="text-center px-2 py-1.5 font-medium">변화</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankSeries.slice(0, 50).map(s => {
                        const TrendIcon = s.trend === 'up' ? ArrowUp : s.trend === 'down' ? ArrowDown : Minus;
                        const trendColor = s.trend === 'up' ? 'text-emerald-600' : s.trend === 'down' ? 'text-red-600' : 'text-gray-400';
                        const diff = s.last - s.first;
                        return (
                          <tr
                            key={s.keyword}
                            className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${selectedKeyword === s.keyword ? 'bg-blue-50' : ''}`}
                            onClick={() => setSelectedKeyword(s.keyword)}
                          >
                            <td className="px-2 py-1.5 text-gray-800 truncate max-w-[140px]">{s.keyword}</td>
                            <td className="px-2 py-1.5 text-center font-bold text-gray-900">{s.last}위</td>
                            <td className={`px-2 py-1.5 text-center ${trendColor}`}>
                              <span className="inline-flex items-center gap-1">
                                <TrendIcon className="w-3 h-3" />
                                {diff === 0 ? '변동없음' : diff > 0 ? `-${diff}` : `+${Math.abs(diff)}`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lg:col-span-3 rounded-lg border border-gray-200 bg-white shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                {selectedSeries ? `${selectedSeries.keyword} 순위 추이` : '키워드 선택'}
              </h3>
              {selectedSeries && selectedSeries.points.length > 0 ? (
                <div className="h-[55vh]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedSeries.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} stroke="#d1d5db" />
                      <YAxis reversed tick={{ fontSize: 11, fill: '#6b7280' }} stroke="#d1d5db"
                        tickFormatter={(v: number) => `${v}위`} domain={[1, 'auto']} />
                      <Tooltip
                        contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number) => [`${value}위`, '순위']}
                      />
                      <Line type="monotone" dataKey="rank" stroke="#093687" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-12 text-center">좌측 목록에서 키워드를 선택하세요</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-[#093687] text-white shadow-sm'
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
