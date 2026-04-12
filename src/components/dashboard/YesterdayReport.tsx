import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { fetchTotalStats } from '@/lib/naverApi';

interface Props { adAccountId: string; targetCampaignId?: string; }

interface DayStats { imp: number; clk: number; cost: number; conv: number; }

export default function YesterdayReport({ adAccountId, targetCampaignId }: Props) {
  const [yesterday, setYesterday] = useState<DayStats | null>(null);
  const [dayBefore, setDayBefore] = useState<DayStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const now = new Date();
        const ydy = new Date(now); ydy.setDate(ydy.getDate() - 1);
        const dby = new Date(now); dby.setDate(dby.getDate() - 2);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);

        const [y, b] = await Promise.all([
          fetchTotalStats(adAccountId, { since: fmt(ydy), until: fmt(ydy) }, 'day', targetCampaignId),
          fetchTotalStats(adAccountId, { since: fmt(dby), until: fmt(dby) }, 'day', targetCampaignId),
        ]);
        const sum = (rows: { impCnt?: number; clkCnt?: number; salesAmt?: number; ccnt?: number }[]) =>
          rows.reduce((a, r) => ({ imp: a.imp + (r.impCnt || 0), clk: a.clk + (r.clkCnt || 0), cost: a.cost + (r.salesAmt || 0), conv: a.conv + (r.ccnt || 0) }), { imp: 0, clk: 0, cost: 0, conv: 0 });
        setYesterday(sum(y));
        setDayBefore(sum(b));
      } catch { /* skip */ }
      finally { setLoading(false); }
    })();
  }, [adAccountId, targetCampaignId]);

  if (loading || !yesterday) {
    return <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-3 text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />어제 데이터 조회 중...</div>;
  }

  const ydyDate = new Date(); ydyDate.setDate(ydyDate.getDate() - 1);
  const dateStr = `${ydyDate.getMonth()+1}/${ydyDate.getDate()}`;

  const ctr = yesterday.imp > 0 ? (yesterday.clk / yesterday.imp) * 100 : 0;
  const cpc = yesterday.clk > 0 ? Math.round(yesterday.cost / yesterday.clk) : 0;

  // 전일 대비
  const clkDiff = dayBefore ? yesterday.clk - dayBefore.clk : 0;
  const costDiff = dayBefore ? yesterday.cost - dayBefore.cost : 0;

  // 상태 평가
  const status = yesterday.imp === 0 ? '🔴 노출 없음' : yesterday.clk === 0 ? '🟡 클릭 없음' : '🟢 정상 노출';

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Calendar className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[0.75rem] font-bold text-blue-700">어제 ({dateStr}) 광고 성과</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
        <div className="flex justify-between text-[0.65rem]">
          <span className="text-slate-500">노출</span>
          <span className="text-slate-800 font-bold">{yesterday.imp.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-[0.65rem]">
          <span className="text-slate-500">클릭</span>
          <span className="text-slate-800 font-bold flex items-center gap-0.5">
            {yesterday.clk}
            {clkDiff !== 0 && (
              <span className={`text-[0.6rem] ${clkDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {clkDiff > 0 ? <TrendingUp className="w-2 h-2 inline" /> : <TrendingDown className="w-2 h-2 inline" />}
                {Math.abs(clkDiff)}
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-[0.65rem]">
          <span className="text-slate-500">CTR</span>
          <span className="text-slate-800 font-bold">{ctr.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-[0.65rem]">
          <span className="text-slate-500">CPC</span>
          <span className="text-slate-800 font-bold">{cpc.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between text-[0.65rem] col-span-2">
          <span className="text-slate-500">광고비</span>
          <span className="text-slate-800 font-bold flex items-center gap-0.5">
            {yesterday.cost.toLocaleString()}원
            {costDiff !== 0 && (
              <span className={`text-[0.6rem] ${costDiff < 0 ? 'text-green-400' : 'text-red-400'}`}>
                {costDiff < 0 ? '▼' : '▲'}{Math.abs(costDiff).toLocaleString()}
              </span>
            )}
          </span>
        </div>
      </div>
      <p className="text-[0.7rem] text-slate-500 pt-1.5 border-t border-slate-100">{status}</p>
    </div>
  );
}
