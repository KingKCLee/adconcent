import { useEffect, useState } from 'react';
import { fetchTotalStats } from '@/lib/naverApi';
import { Wallet, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  adAccountId: string | undefined;
  targetCampaignId?: string;
  dailyBudget: number;
}

export default function BudgetUsageCard({ adAccountId, targetCampaignId, dailyBudget }: Props) {
  const [todayCost, setTodayCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = async () => {
    if (!adAccountId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rows = await fetchTotalStats(adAccountId, { since: today, until: today }, 'hour', targetCampaignId);
      const cost = rows.reduce((s, r) => s + (r.salesAmt || 0), 0);
      setTodayCost(cost);
      setUpdatedAt(new Date());
    } catch { /* skip */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adAccountId, targetCampaignId, dailyBudget]);

  const cost = todayCost ?? 0;
  const remaining = Math.max(dailyBudget - cost, 0);
  const pct = dailyBudget > 0 ? Math.min((cost / dailyBudget) * 100, 100) : 0;

  const tone =
    pct >= 90 ? { bar: 'bg-red-500', text: 'text-red-600', icon: '🔴', label: '소진 임박' } :
    pct >= 70 ? { bar: 'bg-yellow-500', text: 'text-yellow-700', icon: '🟡', label: '주의' } :
                { bar: 'bg-green-500', text: 'text-green-600', icon: '🟢', label: '여유' };

  const ago = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 1000) : 0;
  const agoStr = !updatedAt ? '' : ago < 60 ? `${ago}초 전` : `${Math.floor(ago / 60)}분 전`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Wallet className="w-4 h-4 text-[#093687]" />일예산 소진 현황
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${tone.text}`}>{tone.icon} {tone.label}</span>
          <button onClick={load} disabled={loading} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">오늘 소진</p>
          <p className={`text-xl font-bold ${tone.text}`}>{cost.toLocaleString()}원</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">일예산</p>
          <p className="text-xl font-bold text-slate-800">{dailyBudget.toLocaleString()}원</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">잔여</p>
          <p className="text-xl font-bold text-slate-700">{remaining.toLocaleString()}원</p>
        </div>
      </div>

      <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${tone.bar} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[11px] text-slate-500">소진율 <b className={tone.text}>{pct.toFixed(1)}%</b></span>
        {agoStr && <span className="text-[10px] text-slate-400">{agoStr}</span>}
      </div>
    </div>
  );
}
