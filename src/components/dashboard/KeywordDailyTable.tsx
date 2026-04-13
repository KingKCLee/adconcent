import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const NAVER_PROXY = 'https://srlkttykxpbmrusbavzi.supabase.co/functions/v1/naver-proxy';
const CUSTOMER_ID = '3106493';

interface RankCell {
  keyword: string;
  clicks: number;
  cost: number;
  cpc: number;
}

type RankTable = Record<string, Record<number, RankCell>>;

export default function KeywordDailyTable({ days = 7 }: { days?: number }) {
  const [rankTable, setRankTable] = useState<RankTable>({});
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 날짜 목록 생성
      const dateList: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const kst = new Date(d.getTime() + 9 * 3600 * 1000);
        dateList.push(kst.toISOString().slice(0, 10));
      }
      setDates(dateList);

      // 1. 캠페인 → 광고그룹 → 키워드 전체 조회
      const campRes = await fetch(NAVER_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'GET', path: '/ncc/campaigns', customerId: CUSTOMER_ID }),
      });
      const campData = await campRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeCamps = (campData.data || []).filter((c: any) => !c.userLock && c.status === 'ELIGIBLE');
      const allKeywords: { id: string; keyword: string }[] = [];
      for (const camp of activeCamps) {
        const grpRes = await fetch(NAVER_PROXY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'GET', path: `/ncc/adgroups?nccCampaignId=${camp.nccCampaignId}`, customerId: CUSTOMER_ID }),
        });
        const grpData = await grpRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const grp of (grpData.data || [])) {
          const kwRes = await fetch(NAVER_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'GET', path: `/ncc/keywords?nccAdgroupId=${grp.nccAdgroupId}`, customerId: CUSTOMER_ID }),
          });
          const kwData = await kwRes.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const k of (kwData.data || [])) {
            allKeywords.push({ id: k.nccKeywordId, keyword: k.keyword });
          }
        }
      }

      if (!allKeywords.length) {
        setError('키워드 없음');
        setLoading(false);
        return;
      }

      // 2. rank_logs에서 날짜별 순위별 키워드 추출
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data: rankLogs } = await supabase
        .from('rank_logs')
        .select('keyword, rank, created_at')
        .gte('created_at', since.toISOString())
        .gt('rank', 0)
        .order('created_at', { ascending: false });

      const table: RankTable = {};
      for (const log of rankLogs || []) {
        const kstDate = new Date(new Date(log.created_at).getTime() + 9 * 3600 * 1000)
          .toISOString().slice(0, 10);
        if (!table[kstDate]) table[kstDate] = {};
        // 같은 날짜·같은 순위는 최신(first seen, desc order) 우선
        if (!table[kstDate][log.rank]) {
          table[kstDate][log.rank] = { keyword: log.keyword, clicks: 0, cost: 0, cpc: 0 };
        }
      }

      // 3. 날짜별 Stats API 병렬 호출
      const kwIds = allKeywords.map(k => k.id);
      const idToKw: Record<string, string> = {};
      for (const kw of allKeywords) idToKw[kw.id] = kw.keyword;

      const statsPerDay = await Promise.all(
        dateList.map(async (date) => {
          try {
            const res = await fetch(NAVER_PROXY, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                method: 'POST',
                path: '/stats',
                customerId: CUSTOMER_ID,
                body: { fields: ['clkCnt', 'salesAmt'], timeUnit: 'day', since: date, until: date, ids: kwIds },
              }),
            });
            const d = await res.json();
            return { date, stats: d.data || d.stats || [] };
          } catch {
            return { date, stats: [] };
          }
        }),
      );

      // 4. Stats 결과를 rankTable에 날짜별로 매핑
      for (const { date, stats } of statsPerDay) {
        // stat.id → keyword명 → {clicks, cost, cpc}
        const statsByName: Record<string, { clicks: number; cost: number; cpc: number }> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const stat of stats as any[]) {
          const kwName = idToKw[stat.id];
          if (!kwName) continue;
          const clicks = stat.clkCnt || 0;
          const cost = stat.salesAmt || 0;
          statsByName[kwName] = { clicks, cost, cpc: clicks > 0 ? Math.round(cost / clicks) : 0 };
        }

        // rankTable 셀에 stats 채우기 (keyword명 기준 매칭)
        if (table[date]) {
          for (const rank of Object.keys(table[date])) {
            const cell = table[date][+rank];
            const st = statsByName[cell.keyword];
            if (st) {
              cell.clicks = st.clicks;
              cell.cost = st.cost;
              cell.cpc = st.cpc;
            }
          }
        }
      }

      setRankTable(table);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="h-32 flex items-center justify-center text-sm text-gray-400">
      날짜별 순위 데이터 조회 중...
    </div>
  );

  if (error) return <div className="text-sm text-red-500 p-4">{error}</div>;

  const maxRank = 10;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-center py-2 px-3 border border-gray-200 font-medium text-gray-600 sticky left-0 bg-gray-50 w-12">
              순위
            </th>
            {dates.map(date => (
              <th key={date} className="text-center py-2 px-3 border border-gray-200 font-medium text-gray-600 min-w-32">
                {date.slice(5).replace('-', '/')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRank }, (_, i) => i + 1).map(rank => (
            <tr key={rank} className={rank % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
              <td className="py-2 px-2 border border-gray-200 text-center sticky left-0 font-bold"
                style={{ background: rank % 2 === 0 ? '#f9fafb' : 'white' }}>
                <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${
                  rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                  rank <= 3 ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {rank}
                </span>
              </td>
              {dates.map(date => {
                const cell = rankTable[date]?.[rank];
                return (
                  <td key={date} className="py-2 px-2 border border-gray-200 text-center">
                    {cell ? (
                      <div className="space-y-0.5">
                        <div className="font-medium text-gray-900 text-xs leading-tight">
                          {cell.keyword}
                        </div>
                        {cell.cost > 0 && (
                          <div className="text-blue-600 font-medium">
                            {cell.cost.toLocaleString()}원
                          </div>
                        )}
                        {cell.clicks > 0 && (
                          <div className="text-gray-400">
                            {cell.clicks}클릭 · {cell.cpc.toLocaleString()}원
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-200">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
