import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchCampaigns, fetchAdGroups, fetchKeywords } from '@/lib/naverApi';
import { Swords, Loader2, RefreshCw } from 'lucide-react';

interface Props {
  adAccountId: string | undefined;
}

interface Row {
  keyword: string;
  groupName: string;
  competitorBid: number;
  ourBid: number;
  diff: number;
}

export default function CompetitorBidComparisonCard({ adAccountId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!adAccountId) return;
    setLoading(true);
    try {
      // 1. 최근 24h 경쟁사 1위 평균 (키워드별 최신)
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: comp } = await supabase
        .from('competitor_bids')
        .select('keyword, bids, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      const compMap = new Map<string, number>();
      for (const c of (comp || [])) {
        if (!compMap.has(c.keyword)) {
          const r1 = (c.bids as Record<string, number> | null)?.['1'] || 0;
          if (r1 > 0) compMap.set(c.keyword, r1);
        }
      }

      // 2. Naver 현재 우리 입찰가 — 활성 캠페인 → 광고그룹 → 키워드
      const camps = (await fetchCampaigns(adAccountId)).filter(c => c.status === 'ELIGIBLE');
      const groups = (await Promise.all(camps.map(c => fetchAdGroups(adAccountId, c.nccCampaignId)))).flat();
      const ourRows: Row[] = [];
      for (const g of groups) {
        try {
          const kws = await fetchKeywords(adAccountId, g.nccAdgroupId);
          for (const kw of kws) {
            const cBid = compMap.get(kw.keyword) || 0;
            if (cBid === 0) continue;  // 경쟁사 데이터 없으면 제외
            ourRows.push({
              keyword: kw.keyword,
              groupName: g.name,
              competitorBid: cBid,
              ourBid: kw.bidAmt || 0,
              diff: (kw.bidAmt || 0) - cBid,
            });
          }
        } catch { /* skip */ }
      }
      // 격차 큰 순(= 우위 많은 순) 정렬
      ourRows.sort((a, b) => b.diff - a.diff);
      setRows(ourRows);
    } catch { /* skip */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adAccountId]);

  const winCount = rows.filter(r => r.diff > 0).length;
  const loseCount = rows.filter(r => r.diff <= 0).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Swords className="w-4 h-4 text-[#093687]" />경쟁사 vs 우리 입찰가
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="text-green-600 font-semibold">✅ 우위 {winCount}</span>
          <span className="text-red-600 font-semibold">❌ 부족 {loseCount}</span>
          <button onClick={load} disabled={loading} className="p-1 rounded hover:bg-slate-100">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">
          {loading ? '로딩 중...' : 'competitor_bids 데이터 없음 — crawler 실행 대기'}
        </p>
      ) : (
        <div className="overflow-auto max-h-56">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">키워드</th>
                <th className="px-2 py-1.5 text-right font-medium">경쟁사 1위</th>
                <th className="px-2 py-1.5 text-right font-medium">우리</th>
                <th className="px-2 py-1.5 text-right font-medium">격차</th>
                <th className="px-2 py-1.5 text-center font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const win = r.diff > 0;
                return (
                  <tr key={`${r.keyword}_${r.groupName}`} className="border-t border-slate-100">
                    <td className="px-2 py-1 truncate max-w-[180px] font-medium text-slate-800" title={`${r.keyword} · ${r.groupName}`}>
                      {r.keyword}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums text-slate-600">{r.competitorBid.toLocaleString()}원</td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold">{r.ourBid.toLocaleString()}원</td>
                    <td className={`px-2 py-1 text-right tabular-nums ${win ? 'text-green-600' : 'text-red-600'}`}>
                      {win ? '+' : ''}{r.diff.toLocaleString()}원
                    </td>
                    <td className="px-2 py-1 text-center text-[11px]">
                      {win ? <span className="text-green-600 font-bold">✅ 우위</span> : <span className="text-red-600 font-bold">❌ 부족</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
