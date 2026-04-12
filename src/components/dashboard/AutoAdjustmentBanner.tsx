import { useEffect, useState } from 'react';
import { Sparkles, X, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props { adAccountId: string }

interface AutoAdjustment {
  groupName: string;
  oldMaxBid: number;
  newMaxBid: number;
  requiredBid: number;
  targetRank: number;
  stuckCount: number;
  reason: string;
  adjustedAt: string;
}

interface BidLogRow {
  id: string;
  details: { autoAdjustments?: AutoAdjustment[] } | null;
  created_at: string;
}

const DISMISS_KEY = 'hitad-dismissed-adjustments';

function loadDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveDismissed(set: Set<string>) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set))); } catch { /* skip */ }
}

export default function AutoAdjustmentBanner({ adAccountId }: Props) {
  const [adjustments, setAdjustments] = useState<AutoAdjustment[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [reverting, setReverting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 최근 12시간 내 ad_bid_logs에서 autoAdjustments 수집
        const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
        const { data } = await supabase
          .from('ad_bid_logs')
          .select('id,details,created_at')
          .eq('ad_account_id', adAccountId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20);
        const rows = (data || []) as BidLogRow[];

        // 그룹별로 가장 최신 조정 1건씩만 (중복 제거)
        const latestByGroup = new Map<string, AutoAdjustment>();
        for (const row of rows) {
          const adjs = row.details?.autoAdjustments || [];
          for (const a of adjs) {
            if (!latestByGroup.has(a.groupName)) latestByGroup.set(a.groupName, a);
          }
        }
        setAdjustments(Array.from(latestByGroup.values()));
      } catch { /* skip */ }
    })();
  }, [adAccountId]);

  const dismiss = (groupName: string) => {
    const key = `${adAccountId}:${groupName}`;
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    saveDismissed(next);
  };

  const revert = async (adj: AutoAdjustment) => {
    if (!confirm(`${adj.groupName}의 maxBid를 ${adj.newMaxBid.toLocaleString()} → ${adj.oldMaxBid.toLocaleString()}원으로 되돌립니다.\n목표순위 ${adj.targetRank}위 달성이 다시 불가능해질 수 있습니다.`)) return;
    setReverting(adj.groupName);
    try {
      const { error } = await supabase
        .from('ad_group_settings')
        .update({ max_bid: adj.oldMaxBid })
        .eq('ad_account_id', adAccountId)
        .eq('group_name', adj.groupName);
      if (error) throw error;
      toast.success(`${adj.groupName} maxBid 원상 복구: ${adj.oldMaxBid.toLocaleString()}원`);
      dismiss(adj.groupName);
    } catch (e) {
      toast.error(`되돌리기 실패: ${(e as Error).message}`);
    } finally {
      setReverting(null);
    }
  };

  const visible = adjustments.filter(a => !dismissed.has(`${adAccountId}:${a.groupName}`));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {visible.map(adj => (
        <div key={adj.groupName}
          className="rounded-xl border border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50 px-4 py-3 flex items-center gap-3 shadow-sm">
          <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[0.85rem] font-bold text-purple-800">
              🤖 {adj.groupName} maxBid 자동 조정됨
            </p>
            <p className="text-[0.75rem] text-purple-700">
              <strong>{adj.oldMaxBid.toLocaleString()}</strong> → <strong>{adj.newMaxBid.toLocaleString()}원</strong>
              <span className="text-purple-500 ml-1">({adj.targetRank}위 달성 위해, 경쟁 필요 입찰가 {adj.requiredBid.toLocaleString()}원 · {adj.stuckCount}개 키워드 stuck)</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => revert(adj)}
              disabled={reverting === adj.groupName}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-purple-300 text-purple-700 rounded-lg text-[11px] font-medium hover:bg-purple-100 disabled:opacity-50">
              {reverting === adj.groupName
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RotateCcw className="w-3 h-3" />}
              되돌리기
            </button>
            <button onClick={() => dismiss(adj.groupName)}
              className="p-1 text-purple-400 hover:text-purple-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
