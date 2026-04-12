import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, AlertCircle, CheckCircle, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { fetchCampaigns, fetchTotalStats, fetchBizMoney } from '@/lib/naverApi';
import { supabase } from '@/lib/supabase';
import { useAdStore } from '@/hooks/useAdStore';
import { useNavigate } from 'react-router-dom';

interface Props { adAccountId: string; targetCampaignId?: string; dailyBudget: number; }

interface BlockedGroup {
  status: 'blocked';
  reason: string;
  groupName: string;
  targetRank: number;
  currentRank: number;
  requiredBid: number;
  currentMaxBid: number;
  message: string;
}

interface Status {
  level: 'good' | 'warn' | 'bad';
  title: string;
  reason?: string;
  action?: string;
}

interface Snapshot {
  campaignsActive: number;
  campaignsTotal: number;
  todayImp: number;
  todayClk: number;
  todayCost: number;
  bizMoney: number;
  budgetPct: number;
}

export default function AdStatusMonitor({ adAccountId, targetCampaignId, dailyBudget }: Props) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const exposureSummary = useAdStore(s => s.exposureSummary);
  const navigate = useNavigate();

  const [budgetMismatch, setBudgetMismatch] = useState<{ supabase: number; naver: number } | null>(null);
  const [blockedGroups, setBlockedGroups] = useState<BlockedGroup[]>([]);

  // 최신 ad_bid_logs에서 blockedGroups 조회
  useEffect(() => {
    if (!adAccountId) return;
    let cancelled = false;
    const fetchBlocked = async () => {
      const { data } = await supabase
        .from('ad_bid_logs')
        .select('details')
        .eq('ad_account_id', adAccountId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      const latest = data?.[0]?.details as { blockedGroups?: BlockedGroup[] } | null;
      setBlockedGroups(latest?.blockedGroups || []);
    };
    fetchBlocked();
    const t = setInterval(fetchBlocked, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [adAccountId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [camps, stats, bm] = await Promise.all([
        fetchCampaigns(adAccountId),
        fetchTotalStats(adAccountId, { since: today, until: today }, 'hour', targetCampaignId),
        fetchBizMoney(adAccountId),
      ]);
      const active = camps.filter(c => c.status === 'ELIGIBLE' && !c.userLock).length;
      const totals = stats.reduce((a, r) => ({ imp: a.imp + (r.impCnt || 0), clk: a.clk + (r.clkCnt || 0), cost: a.cost + (r.salesAmt || 0) }), { imp: 0, clk: 0, cost: 0 });

      // 일예산 불일치 감지
      const targetCamp = targetCampaignId ? camps.find(c => c.nccCampaignId === targetCampaignId) : camps.find(c => c.status === 'ELIGIBLE');
      if (targetCamp && targetCamp.dailyBudget !== dailyBudget && dailyBudget > 0) {
        setBudgetMismatch({ supabase: dailyBudget, naver: targetCamp.dailyBudget || 0 });
      } else {
        setBudgetMismatch(null);
      }

      setSnap({
        campaignsActive: active,
        campaignsTotal: camps.length,
        todayImp: totals.imp,
        todayClk: totals.clk,
        todayCost: totals.cost,
        bizMoney: bm,
        budgetPct: dailyBudget > 0 ? Math.min((totals.cost / dailyBudget) * 100, 100) : 0,
      });
      setLastUpdate(new Date());
    } catch { /* skip */ }
    finally { setLoading(false); }
  }, [adAccountId, targetCampaignId, dailyBudget]);

  const handleSyncBudget = async () => {
    if (!budgetMismatch || !adAccountId) return;
    try {
      const { updateCampaignBudget } = await import('@/lib/naverApi');
      const camps = await fetchCampaigns(adAccountId);
      const targets = targetCampaignId ? camps.filter(c => c.nccCampaignId === targetCampaignId) : camps.filter(c => c.status === 'ELIGIBLE');
      for (const c of targets) {
        await updateCampaignBudget(adAccountId, c.nccCampaignId, dailyBudget);
      }
      await refresh();
    } catch { /* skip */ }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!snap) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />광고 상태 확인 중...
      </div>
    );
  }

  // 상태 판정
  let status: Status;
  if (snap.bizMoney > 0 && snap.bizMoney < 50000) {
    status = { level: 'bad', title: '비즈머니 부족', reason: `잔액 ${Math.floor(snap.bizMoney).toLocaleString()}원`, action: '충전 필요' };
  } else if (snap.campaignsActive === 0) {
    status = { level: 'bad', title: '활성 캠페인 없음', reason: `${snap.campaignsTotal}개 모두 OFF`, action: '캠페인 ON 필요' };
  } else if (snap.budgetPct >= 95) {
    status = { level: 'bad', title: '일예산 소진', reason: `${snap.todayCost.toLocaleString()}원 / ${dailyBudget.toLocaleString()}원 (${Math.round(snap.budgetPct)}%)`, action: '일예산 증액' };
  } else if (snap.todayImp === 0) {
    status = { level: 'warn', title: '오늘 노출 없음', reason: '캠페인은 ON 상태', action: '키워드 [진단] 확인' };
  } else if (snap.todayImp > 0 && snap.todayClk === 0 && snap.todayImp >= 100) {
    status = { level: 'warn', title: '클릭 없음', reason: `${snap.todayImp.toLocaleString()}회 노출 / 0 클릭`, action: '소재 또는 입찰가 점검' };
  } else {
    status = { level: 'good', title: '광고 정상 운영 중', reason: `${snap.campaignsActive}개 캠페인 활성` };
  }

  const colors = {
    good: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: CheckCircle, dot: 'bg-green-500' },
    warn: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: AlertCircle, dot: 'bg-yellow-500' },
    bad: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: XCircle, dot: 'bg-red-500' },
  };
  const c = colors[status.level];
  const Icon = c.icon;

  const ago = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : 0;
  const agoStr = ago < 60 ? `${ago}초 전` : `${Math.floor(ago / 60)}분 전`;

  return (
    <div className="space-y-2">
      {/* 목표순위 달성 불가 경고 */}
      {blockedGroups.map(b => (
        <div key={b.groupName} className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[0.9rem] font-bold text-red-700">⚠️ 목표순위 달성 불가 — {b.groupName}</p>
              <p className="text-[0.75rem] text-red-700 mt-0.5">
                목표: <span className="font-semibold">{b.targetRank}위</span> · 현재:{' '}
                <span className="font-semibold">{b.currentRank}위</span>
              </p>
              <p className="text-[0.75rem] text-red-700 mt-0.5">
                {b.targetRank}위 달성에 필요한 입찰가:{' '}
                <span className="font-bold">{b.requiredBid.toLocaleString()}원</span> · 현재 최대 입찰가:{' '}
                <span className="font-bold">{b.currentMaxBid.toLocaleString()}원</span>
              </p>
              <p className="text-[0.7rem] text-red-600 mt-1">최대 입찰가를 올려야 {b.targetRank}위 달성 가능합니다.</p>
            </div>
            <button
              onClick={() => navigate(`/ad/automation?highlight=${encodeURIComponent(b.groupName)}`)}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
            >
              자동화 설정에서 변경 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}

      {/* 일예산 불일치 경고 */}
      {budgetMismatch && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-center gap-3 shadow-sm">
          <span className="text-red-600">🔴</span>
          <div className="flex-1 min-w-0">
            <p className="text-[0.85rem] font-bold text-red-700">일예산 불일치 — 네이버에 반영되지 않았습니다</p>
            <p className="text-[0.75rem] text-red-600">설정값 {budgetMismatch.supabase.toLocaleString()}원 / 네이버 실제 {budgetMismatch.naver.toLocaleString()}원</p>
          </div>
          <button onClick={handleSyncBudget} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">지금 반영하기</button>
        </div>
      )}
    <div className={`rounded-xl border ${c.bg} ${c.border} px-4 py-3 flex items-center gap-4 shadow-sm`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <Icon className={`w-5 h-5 ${c.text}`} />
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
        </div>
        <div className="min-w-0">
          <p className={`text-[0.875rem] font-bold ${c.text} truncate`}>{status.title}</p>
          {status.reason && <p className="text-[0.75rem] text-slate-600 truncate">{status.reason}{status.action && ` · ${status.action}`}</p>}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4 shrink-0">
        <div className="hidden md:flex items-center gap-4 text-[0.75rem]">
          <span className="text-slate-500">캠페인 <span className="text-slate-800 font-bold">{snap.campaignsActive}/{snap.campaignsTotal}</span></span>
          <span className="text-slate-500">노출 <span className="text-slate-800 font-bold">{snap.todayImp.toLocaleString()}</span></span>
          <span className="text-slate-500">광고비 <span className="text-slate-800 font-bold">{snap.todayCost.toLocaleString()}원</span></span>
          <span className="text-slate-500">예산 <span className="text-slate-800 font-bold">{Math.round(snap.budgetPct)}%</span></span>
        </div>
        <button onClick={refresh} className="p-1.5 rounded hover:bg-white/60 text-slate-500 hover:text-slate-700" title="새로고침">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[0.7rem] text-slate-400 hidden md:inline">{agoStr}</span>
      </div>
    </div>

    {/* 노출 진단 요약 위젯 */}
    {exposureSummary && (
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 text-xs shadow-sm">
        <span className="text-green-600 font-medium">🟢 정상 {exposureSummary.normal}개</span>
        <span className="text-yellow-600 font-medium">🟡 주의 {exposureSummary.warning}개</span>
        <span className="text-red-600 font-medium">🔴 미노출 {exposureSummary.error}개</span>
        {exposureSummary.error > 0 && (
          <button onClick={() => navigate('/ad/diagnosis')}
            className="ml-auto text-red-600 underline font-medium hover:text-red-700">
            지금 진단하기 →
          </button>
        )}
      </div>
    )}
    </div>
  );
}
