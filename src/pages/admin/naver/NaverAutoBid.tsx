import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { workerFetch } from '@/lib/api';

interface BidSetting {
  id: number;
  site_id: string;
  keyword_id: string;
  keyword: string;
  target_rank: number;
  max_bid: number;
  min_bid: number;
  is_active: number;
  device: string;
}

interface RankBids {
  rank1?: number;
  rank3?: number;
  rank5?: number;
  current?: number;
}

export default function NaverAutoBid() {
  const { siteId } = useSite();
  const [rows, setRows] = useState<BidSetting[]>([]);
  const [rankMap, setRankMap] = useState<Record<string, RankBids>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    workerFetch<{ data: BidSetting[] }>(`/naver/bid-settings?site_id=${siteId}`)
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]));
  }, [siteId]);

  async function quickBid(row: BidSetting, rank: 1 | 3 | 5) {
    if (!siteId) return;
    const ranks = rankMap[row.keyword_id];
    const newBid = ranks?.[`rank${rank}` as keyof RankBids];
    if (!newBid) {
      setMsg(`${row.keyword} 견적가 미조회 — 행 클릭으로 견적가 먼저 로드.`);
      return;
    }
    setBusy(row.keyword_id);
    setMsg(null);
    try {
      await workerFetch(`/naver`, {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          method: 'PUT',
          path: `/ncc/keywords/${row.keyword_id}`,
          body: { bidAmt: newBid },
        }),
      });
      setMsg(`${row.keyword}: ${rank}위 견적가 ₩${newBid.toLocaleString()}로 즉시 적용 ✓`);
    } catch (e) {
      setMsg(`PUT 실패: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function loadEstimates(row: BidSetting) {
    if (rankMap[row.keyword_id] || !siteId) return;
    try {
      const r = await workerFetch<any>(`/naver`, {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          method: 'POST',
          path: '/estimate/performance/keyword',
          body: { device: row.device || 'PC', keywordplus: false, items: [{ key: row.keyword }] },
        }),
      });
      const e = r.data?.[0]?.bidEstimate || {};
      setRankMap((p) => ({
        ...p,
        [row.keyword_id]: {
          rank1: e.high?.position1?.bid,
          rank3: e.high?.position3?.bid,
          rank5: e.high?.position5?.bid,
          current: row.max_bid,
        },
      }));
    } catch { /* noop */ }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#03C75A]" />
        <h1 className="text-xl font-bold text-gray-900">네이버 자동입찰 (원클릭 순위 적용)</h1>
      </div>
      <p className="text-sm text-gray-500">
        키워드 행 클릭 → 1위/3위/5위 견적가 표시. <strong>1/3/5위 셀 클릭 → 즉시 PUT</strong>.
        bid_settings {rows.length} 키워드 LIVE.
      </p>

      {msg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm">{msg}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">키워드</th>
              <th className="px-3 py-2 text-center">목표</th>
              <th className="px-3 py-2 text-center">현재 max</th>
              <th className="px-3 py-2 text-center">1위</th>
              <th className="px-3 py-2 text-center">3위</th>
              <th className="px-3 py-2 text-center">5위</th>
              <th className="px-3 py-2 text-center">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-12 text-center text-gray-400">키워드가 없습니다 — bid_settings 등록 필요</td></tr>
            ) : rows.map((row) => {
              const ranks = rankMap[row.keyword_id];
              return (
                <tr
                  key={row.keyword_id}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => loadEstimates(row)}
                >
                  <td className="px-3 py-2 font-medium">{row.keyword}</td>
                  <td className="px-3 py-2 text-center text-xs">{row.target_rank}위</td>
                  <td className="px-3 py-2 text-center text-xs">₩{row.max_bid.toLocaleString()}</td>
                  {[1, 3, 5].map((r) => {
                    const v = ranks?.[`rank${r}` as keyof RankBids];
                    return (
                      <td key={r} className="px-3 py-2 text-center">
                        <button
                          disabled={!v || busy === row.keyword_id}
                          onClick={(e) => { e.stopPropagation(); quickBid(row, r as 1 | 3 | 5); }}
                          className={`w-full text-xs font-bold px-2 py-1 rounded ${
                            v ? 'bg-[#03C75A]/10 text-[#03C75A] hover:bg-[#03C75A]/20' : 'bg-gray-50 text-gray-300'
                          } disabled:opacity-50`}
                        >
                          {v ? `₩${v.toLocaleString()}` : '—'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    {row.is_active ? (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded">ON</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded">OFF</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
