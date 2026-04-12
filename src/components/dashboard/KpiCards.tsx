import { DollarSign, MousePointer, Target, TrendingUp, Wallet } from 'lucide-react';

type DrilldownType = 'cost' | 'clicks' | 'impressions' | 'conversions';

interface KpiCardsProps {
  bizMoney: number; todayCost: number; dailyBudget: number; clicks: number; ctr: number;
  conversions: number; cpa: number; targetCpa: number; impressions?: number;
  avgQi?: number;
  onDrilldown?: (type: DrilldownType) => void;
}

export default function KpiCards({ bizMoney, todayCost, dailyBudget, clicks, ctr, conversions, cpa, targetCpa, impressions, avgQi, onDrilldown }: KpiCardsProps) {
  const budgetPct = dailyBudget > 0 ? Math.min((todayCost / dailyBudget) * 100, 100) : 0;
  const cpaOk = cpa === 0 ? 'normal' : cpa <= targetCpa ? 'good' : cpa <= targetCpa * 1.2 ? 'warn' : 'bad';

  const cards: { icon: typeof Wallet; label: string; value: string; sub: string; color: string; drill?: DrilldownType; bar?: number; warn?: boolean }[] = [
    { icon: Wallet, label: '비즈머니', value: `${Math.floor(bizMoney).toLocaleString()}`, sub: bizMoney > 0 && bizMoney < 100000 ? '⚠ 잔액 부족' : '원', color: '#3b82f6', warn: bizMoney > 0 && bizMoney < 50000 },
    { icon: DollarSign, label: '광고비', value: `${todayCost.toLocaleString()}`, sub: dailyBudget > 0 ? `일예산 ${Math.round(budgetPct)}% 사용` : '원', color: '#f59e0b', drill: 'cost', bar: budgetPct },
    { icon: MousePointer, label: '클릭수', value: clicks.toLocaleString(), sub: `CTR ${ctr.toFixed(2)}%${impressions ? ` · 노출 ${impressions.toLocaleString()}` : ''}`, color: '#10b981', drill: 'clicks' },
    { icon: Target, label: '전환', value: conversions.toLocaleString(), sub: clicks > 0 ? `CVR ${((conversions/clicks)*100).toFixed(1)}%` : '-', color: '#8b5cf6', drill: 'conversions' },
    { icon: TrendingUp, label: 'CPA', value: cpa > 0 ? `${cpa.toLocaleString()}` : '-',
      sub: cpaOk === 'good' ? '🟢 목표 달성' : cpaOk === 'warn' ? '🟡 목표 초과' : cpaOk === 'bad' ? '🔴 30%+ 초과' : `목표 ${targetCpa.toLocaleString()}원`,
      color: cpaOk === 'good' ? '#10b981' : cpaOk === 'warn' ? '#f59e0b' : cpaOk === 'bad' ? '#ef4444' : '#64748b' },
  ];

  const qiColor = avgQi == null ? '#64748b' : avgQi >= 7 ? '#10b981' : avgQi >= 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-2">
    {avgQi != null && (
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
          <span className="text-[11px] text-slate-500 font-medium">평균 품질지수 (QI)</span>
          <span className="text-sm font-bold" style={{ color: qiColor }}>{avgQi.toFixed(1)}칸</span>
        </div>
      </div>
    )}
    <div className="grid grid-cols-5 gap-3">
      {cards.map((c, i) => (
        <div key={i} onClick={() => c.drill && onDrilldown?.(c.drill)}
          className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 transition-all ${c.drill ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''} ${c.warn ? 'border-red-300 ring-1 ring-red-100' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.color + '15' }}>
              <c.icon className="w-4 h-4" style={{ color: c.color }} />
            </div>
            <span className="text-[0.875rem] text-slate-600 font-medium">{c.label}</span>
          </div>
          <p className="text-[2rem] font-bold text-slate-800 leading-none tracking-tight">{c.value}</p>
          <p className="text-[0.75rem] text-slate-500 mt-1.5">{c.sub}</p>
          {c.bar != null && c.bar > 0 && (
            <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className={`h-full rounded-full ${budgetPct > 90 ? 'bg-red-500' : budgetPct > 70 ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${c.bar}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
    </div>
  );
}
