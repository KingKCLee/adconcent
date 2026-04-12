import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, RefreshCw, Target } from 'lucide-react';

interface RankRow {
  keyword: string;
  rank: number;
  total_ads: number;
  matched_url: string | null;
  created_at: string;
}

// 최신 3분 이내의 각 키워드별 최신 1건 조회
export default function LiveRankCard() {
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // 최근 10분 내 row 전부 가져와서 키워드별 최신 1건만 추림
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('rank_logs')
        .select('keyword,rank,total_ads,matched_url,created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100);
      const latestByKeyword = new Map<string, RankRow>();
      for (const row of (data || []) as RankRow[]) {
        if (!latestByKeyword.has(row.keyword)) latestByKeyword.set(row.keyword, row);
      }
      setRows(Array.from(latestByKeyword.values()));
      setUpdatedAt(new Date());
    } catch { /* skip */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000); // 1분마다 갱신 (rank-tracker는 3분 cron)
    return () => clearInterval(t);
  }, []);

  if (rows.length === 0 && !loading) return null;

  const rankColor = (r: number) => {
    if (r === 0) return { bg: 'bg-blue-50', text: 'text-blue-700', label: '⚙️ 입찰 조정중' };
    if (r === 1) return { bg: 'bg-green-100', text: 'text-green-700', label: `🟢 ${r}위` };
    if (r <= 3) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: `🟡 ${r}위` };
    return { bg: 'bg-red-100', text: 'text-red-700', label: `🔴 ${r}위` };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#093687]" />
          <h3 className="text-sm font-bold text-slate-800">실시간 광고 순위</h3>
          <span className="text-[10px] text-slate-400">3분마다 자동 갱신</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50 rounded"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {updatedAt && <span>{updatedAt.toLocaleTimeString('ko-KR')}</span>}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map(r => {
          const c = rankColor(r.rank);
          return (
            <div key={r.keyword} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
              <span className="truncate text-slate-700 font-medium" title={r.keyword}>{r.keyword}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] text-slate-400">/{r.total_ads}개중</span>
                <span
                  className={`px-1.5 py-0.5 rounded ${c.bg} ${c.text} font-bold text-[11px]`}
                  title={r.rank === 0 ? '3분마다 입찰가 인상 중. 잠시 후 순위가 표시됩니다.' : undefined}
                >
                  {c.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {rows.every(r => r.rank === 0) && (
        <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-700">
          ⚙️ 전 키워드 입찰 조정중 — bid-optimizer가 3분마다 10% 인상 중. 잠시 후 순위 반영 예정.
        </div>
      )}
    </div>
  );
}
