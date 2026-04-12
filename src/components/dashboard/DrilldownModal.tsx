import { useState, useEffect } from 'react';
import { X, Loader2, ArrowRight } from 'lucide-react';
import { fetchCampaigns, fetchAdGroups, fetchKeywords, fetchKeywordStats, type KeywordStatRow } from '@/lib/naverApi';
import type { NaverKeyword } from '@/lib/types';

type DrilldownType = 'cost' | 'clicks' | 'impressions' | 'conversions';

interface Props {
  adAccountId: string;
  type: DrilldownType;
  dateLabel: string;
  since: string;
  until: string;
  onClose: () => void;
  onNavigateKeywords?: () => void;
}

interface KwRow {
  keyword: string;
  keywordId: string;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  cpc: number;
}

const TITLES: Record<DrilldownType, string> = {
  cost: '키워드별 광고비', clicks: '키워드별 클릭수',
  impressions: '키워드별 노출수', conversions: '키워드별 전환수',
};
const SORT_KEY: Record<DrilldownType, keyof KwRow> = {
  cost: 'cost', clicks: 'clicks', impressions: 'impressions', conversions: 'conversions',
};

export default function DrilldownModal({ adAccountId, type, dateLabel, since, until, onClose, onNavigateKeywords }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<KwRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1. 전체 키워드 수집
        const campaigns = await fetchCampaigns(adAccountId);
        const allKws: NaverKeyword[] = [];
        for (const c of campaigns) {
          const ags = await fetchAdGroups(adAccountId, c.nccCampaignId);
          for (const ag of ags) {
            const kws = await fetchKeywords(adAccountId, ag.nccAdgroupId);
            allKws.push(...kws);
          }
        }
        if (allKws.length === 0) { setRows([]); setLoading(false); return; }

        // 2. 키워드 ID → 이름 매핑
        const nameMap: Record<string, string> = {};
        for (const kw of allKws) nameMap[kw.nccKeywordId] = kw.keyword;

        // 3. 키워드 stats 조회
        const ids = allKws.map(k => k.nccKeywordId);
        const stats = await fetchKeywordStats(adAccountId, ids);

        // 4. 키워드별 합산
        const agg: Record<string, { cost: number; clicks: number; impressions: number; conversions: number }> = {};
        for (const s of stats) {
          if (!agg[s.id]) agg[s.id] = { cost: 0, clicks: 0, impressions: 0, conversions: 0 };
          agg[s.id].cost += s.salesAmt || 0;
          agg[s.id].clicks += s.clkCnt || 0;
          agg[s.id].impressions += s.impCnt || 0;
          agg[s.id].conversions += s.ccnt || 0;
        }

        // 5. 행 생성 + 정렬
        const sortField = SORT_KEY[type];
        const result: KwRow[] = Object.entries(agg)
          .map(([id, v]) => ({
            keyword: nameMap[id] || id,
            keywordId: id,
            ...v,
            cpc: v.clicks > 0 ? Math.round(v.cost / v.clicks) : 0,
          }))
          .filter(r => Number(r[sortField]) > 0)
          .sort((a, b) => (b[sortField] as number) - (a[sortField] as number));

        setRows(result);
      } catch (e) {
        console.error(e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [adAccountId, type, since, until]);

  const total = rows.reduce((s, r) => ({
    cost: s.cost + r.cost, clicks: s.clicks + r.clicks,
    impressions: s.impressions + r.impressions, conversions: s.conversions + r.conversions,
  }), { cost: 0, clicks: 0, impressions: 0, conversions: 0 });

  const maxVal = rows.length > 0 ? Math.max(...rows.map(r => r[SORT_KEY[type]] as number)) : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-bold text-foreground">{TITLES[type]} ({dateLabel})</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              총 {type === 'cost' ? `${total.cost.toLocaleString()}원` : type === 'clicks' ? `${total.clicks}클릭` : type === 'impressions' ? `${total.impressions.toLocaleString()}회` : `${total.conversions}건`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50"><X className="w-4 h-4" /></button>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />키워드별 데이터 조회 중...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">이 기간에 데이터가 없어요</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">키워드</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">광고비</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">클릭</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">CPC</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">노출</th>
                  <th className="w-24 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.keywordId} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{r.keyword}</td>
                    <td className="px-4 py-2 text-right">{r.cost.toLocaleString()}원</td>
                    <td className="px-4 py-2 text-right">{r.clicks}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{r.cpc > 0 ? `${r.cpc.toLocaleString()}원` : '-'}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{r.impressions.toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round(((r[SORT_KEY[type]] as number) / maxVal) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {onNavigateKeywords && (
          <div className="px-5 py-3 border-t bg-muted/30">
            <button onClick={onNavigateKeywords} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              키워드 탭으로 이동 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
