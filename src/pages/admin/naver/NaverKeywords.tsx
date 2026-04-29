import { useEffect, useState } from 'react';
import { useSite } from '@/contexts/SiteContext';
import { workerFetch } from '@/lib/api';

interface GroupRow {
  id: number;
  group_id: string;
  group_name: string | null;
  campaign_name: string | null;
  target_rank: number;
  max_bid: number;
  min_bid: number;
  is_active: number;
}

export default function NaverKeywords() {
  const { siteId } = useSite();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [hint, setHint] = useState('');
  const [related, setRelated] = useState<{ relKeyword: string; monthlyPcQcCnt?: number; monthlyMobileQcCnt?: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    workerFetch<{ data: GroupRow[] }>(`/naver/group-strategy?site_id=${siteId}`)
      .then((r) => setGroups(r.data || []))
      .catch(() => setGroups([]));
  }, [siteId]);

  async function expand() {
    if (!hint || !siteId) return;
    setLoading(true);
    try {
      const r = await workerFetch<any>(`/naver`, {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          method: 'GET',
          path: `/keywordstool?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`,
        }),
      });
      setRelated(r.data?.keywordList || []);
    } catch {
      setRelated([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#03C75A]" />
        <h1 className="text-xl font-bold text-gray-900">네이버 키워드</h1>
      </div>
      <p className="text-sm text-gray-500">자동확장 (네이버 keywordstool) + 그룹 전략 (group_settings).</p>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-bold text-sm mb-3">키워드 자동확장</h2>
        <div className="flex gap-2">
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="시드 키워드 (예: 시흥분양)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            onKeyDown={(e) => e.key === 'Enter' && expand()}
          />
          <button onClick={expand} disabled={!hint || loading}
            className="px-4 py-2 rounded-lg bg-[#03C75A] text-white text-sm font-medium disabled:opacity-50">
            {loading ? '...' : '확장'}
          </button>
        </div>
        {related.length > 0 && (
          <div className="mt-4 max-h-72 overflow-auto border border-gray-100 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">키워드</th>
                  <th className="px-2 py-1.5 text-right">PC 월 검색</th>
                  <th className="px-2 py-1.5 text-right">모바일 월 검색</th>
                </tr>
              </thead>
              <tbody>
                {related.slice(0, 50).map((k, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1.5">{k.relKeyword}</td>
                    <td className="px-2 py-1.5 text-right">{k.monthlyPcQcCnt?.toLocaleString() ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{k.monthlyMobileQcCnt?.toLocaleString() ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-bold text-sm mb-3">그룹 전략 ({groups.length})</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 그룹 전략이 없습니다.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left">캠페인 / 그룹</th>
                <th className="px-2 py-1.5 text-center">목표순위</th>
                <th className="px-2 py-1.5 text-center">max</th>
                <th className="px-2 py-1.5 text-center">min</th>
                <th className="px-2 py-1.5 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{g.group_name || g.group_id}</div>
                    <div className="text-[10px] text-gray-400">{g.campaign_name || '—'}</div>
                  </td>
                  <td className="px-2 py-1.5 text-center">{g.target_rank}위</td>
                  <td className="px-2 py-1.5 text-center">₩{g.max_bid.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-center">₩{g.min_bid.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                      style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>
                      {g.is_active ? 'ON' : 'OFF'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
