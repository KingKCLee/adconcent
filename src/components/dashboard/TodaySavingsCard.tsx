import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PiggyBank, Loader2 } from 'lucide-react';

interface Props {
  adAccountId: string | undefined;
}

interface ChangeRow {
  keyword: string;
  currentBid: number;
  newBid: number;
  reason: string;
  changed: boolean;
}

// 오늘 자동입찰로 절감된 추정 광고비
// = Σ (변경 전 입찰가 - 변경 후 입찰가)  (newBid < currentBid 인 경우만)
// 클릭수 곱은 실측 불가하여 "입찰가 감소분 × 예상 클릭 1" 이라는 보수적 추정
export default function TodaySavingsCard({ adAccountId }: Props) {
  const [savings, setSavings] = useState(0);
  const [increased, setIncreased] = useState(0);
  const [changeCount, setChangeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!adAccountId) return;
    const load = async () => {
      setLoading(true);
      try {
        const since = new Date();
        since.setHours(0, 0, 0, 0);
        const { data } = await supabase
          .from('ad_bid_logs')
          .select('details, created_at')
          .eq('ad_account_id', adAccountId)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false });

        let savingSum = 0;
        let increaseSum = 0;
        let cnt = 0;
        for (const log of (data || [])) {
          const det = log.details as { changes?: ChangeRow[] } | null;
          const changes = det?.changes || [];
          for (const c of changes) {
            if (!c.changed) continue;
            const diff = (c.currentBid || 0) - (c.newBid || 0);
            if (diff > 0) savingSum += diff;
            else if (diff < 0) increaseSum += -diff;
            cnt++;
          }
        }
        setSavings(savingSum);
        setIncreased(increaseSum);
        setChangeCount(cnt);
      } catch { /* skip */ }
      finally { setLoading(false); }
    };
    load();
    const t = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [adAccountId]);

  const net = savings - increased;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-3">
        <PiggyBank className="w-4 h-4 text-green-600" />오늘의 자동입찰 조정 효과
        {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">입찰가 절감</p>
          <p className="text-xl font-bold text-green-600 tabular-nums">-{savings.toLocaleString()}원</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">입찰가 인상</p>
          <p className="text-xl font-bold text-blue-600 tabular-nums">+{increased.toLocaleString()}원</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">순절감</p>
          <p className={`text-xl font-bold tabular-nums ${net >= 0 ? 'text-green-700' : 'text-orange-600'}`}>
            {net >= 0 ? '-' : '+'}{Math.abs(net).toLocaleString()}원
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-2">
        * 자정 이후 실행된 bid-optimizer 로그({changeCount}건 변경) 기준 — 클릭 1회당 입찰가 차이의 합계 (보수적 추정)
      </p>
    </div>
  );
}
