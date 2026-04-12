import { AlertTriangle, TrendingUp, Info, ArrowRight } from 'lucide-react';

interface SuggestionPanelProps {
  cpa: number; targetCpa: number; ctr: number; bizMoney: number; todayCost: number; dailyBudget: number;
  onNavigate?: (tab: string) => void;
}

interface Tip { level: 'urgent' | 'warn' | 'info'; text: string; action?: string; tab?: string; }

export default function SuggestionPanel({ cpa, targetCpa, ctr, bizMoney, todayCost, dailyBudget, onNavigate }: SuggestionPanelProps) {
  const tips: Tip[] = [];

  // 긴급
  if (bizMoney > 0 && bizMoney < 50000) tips.push({ level: 'urgent', text: `비즈머니가 ${Math.floor(bizMoney).toLocaleString()}원 남았습니다. 광고가 곧 중단됩니다.`, action: '충전하기' });
  if (cpa > 0 && cpa > targetCpa * 2) tips.push({ level: 'urgent', text: `CPA가 목표의 ${Math.round(cpa/targetCpa*100)}%입니다. 입찰가를 낮추거나 저효율 키워드를 중지하세요.`, action: '입찰가 조정', tab: 'automation' });

  // 권고
  if (cpa > 0 && cpa > targetCpa * 1.1 && cpa <= targetCpa * 2) tips.push({ level: 'warn', text: `CPA ${cpa.toLocaleString()}원 — 목표(${targetCpa.toLocaleString()}원) 대비 ${Math.round((cpa/targetCpa-1)*100)}% 높습니다.`, action: '자동화 설정', tab: 'automation' });
  if (dailyBudget > 0 && todayCost < dailyBudget * 0.2 && todayCost > 0) tips.push({ level: 'warn', text: `오늘 광고비가 일예산의 ${Math.round(todayCost/dailyBudget*100)}%만 사용됐습니다. 입찰가가 낮거나 순위가 낮을 수 있어요.`, action: '확인하기', tab: 'keywords' });
  if (ctr > 0 && ctr < 1) tips.push({ level: 'warn', text: `CTR ${ctr.toFixed(2)}% — 1% 미만이면 광고 소재 개선이 필요합니다.` });

  // 정보
  if (cpa > 0 && cpa <= targetCpa * 0.8) tips.push({ level: 'info', text: `CPA 우수! 입찰가를 올려 노출을 확대할 수 있습니다.`, action: '확대하기', tab: 'automation' });
  if (tips.length === 0) tips.push({ level: 'info', text: '정상 운영 중입니다.' });

  const icons = { urgent: AlertTriangle, warn: AlertTriangle, info: cpa > 0 && cpa <= targetCpa ? TrendingUp : Info };
  const colors = { urgent: 'text-red-600 bg-red-50', warn: 'text-yellow-700 bg-yellow-50', info: 'text-blue-600 bg-blue-50' };
  const iconColors = { urgent: 'text-red-500', warn: 'text-yellow-500', info: 'text-blue-500' };

  return (
    <div className="space-y-2">
      {tips.map((t, i) => {
        const Icon = icons[t.level];
        return (
          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${colors[t.level]}`}>
            <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${iconColors[t.level]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] leading-relaxed">{t.text}</p>
              {t.action && onNavigate && t.tab && (
                <button onClick={() => onNavigate(t.tab!)} className="flex items-center gap-1 text-[10px] font-medium mt-1 hover:underline">
                  {t.action} <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
