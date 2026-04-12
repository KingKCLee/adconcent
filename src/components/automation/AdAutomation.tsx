import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Zap, Save, Play, Loader2, CheckCircle, XCircle, History, HelpCircle, Sparkles, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useAdAccount } from '@/hooks/useAdAccount';
import { toast } from 'sonner';
import { useAdStore } from '@/hooks/useAdStore';
import TimeStrategy from './TimeStrategy';
import KeywordAutomationTable from './KeywordAutomationTable';
import HelpTooltip from '@/components/common/HelpTooltip';
import type { AdGroupSettingRow, AdBidLogRow } from '@/lib/types';
import {
  fetchCampaigns, fetchAdGroups, fetchKeywords, fetchBidEstimates,
  updateKeywordBid, fetchKeywordStats,
  type KeywordStatRow,
} from '@/lib/naverApi';
import {
  DEFAULT_TARGET_RANKS,
  estimateToRankBids,
  calculateBidByTargetRank,
  calculateOptimalBid,
  aggregateStats,
  getTimeMultiplier,
} from '@/lib/bidOptimizer';

interface AdAutomationProps {
  adAccountId: string | undefined;
}

const DEFAULT_GROUPS = [
  { group_name: 'S등급_분양직접', target_cpa: 30000, max_bid: 2000, min_bid: 200, target_rank: 3 },
  { group_name: 'A등급_관심비교', target_cpa: 25000, max_bid: 1500, min_bid: 150, target_rank: 5 },
  { group_name: 'B등급_경쟁탐색', target_cpa: 20000, max_bid: 1000, min_bid: 100, target_rank: 7 },
  { group_name: '브랜드_방어', target_cpa: 15000, max_bid: 800, min_bid: 70, target_rank: 1 },
];

interface BlockedGroup {
  status: 'blocked';
  reason: string;
  groupName: string;
  targetRank: number;
  currentRank: number;
  requiredBid: number;
  currentMaxBid: number;
  stuckCount?: number;
  message: string;
}

interface BidLog {
  id: string;
  strategy: string;
  totalKeywords: number;
  totalChanged: number;
  totalSkipped: number;
  avgBid: number;
  elapsedMs: number;
  createdAt: string;
  details?: { changes?: ChangeDetail[]; blockedGroups?: BlockedGroup[] };
}

interface ChangeDetail {
  keyword: string;
  adGroup: string;
  currentBid: number;
  newBid: number;
  reason: string;
  changed: boolean;
}

interface AiRecommendation {
  groupName: string;
  targetRank: number;
  maxBid: number;
  reasons: string[];
  effects: string[];
}

interface GroupCompetitorData {
  keywords: { keyword: string; bid: number; rankBids: Record<number, number> }[];
  avg: Record<number, number>; // rank → avg bid
  loading: boolean;
}

const TOOLTIPS: Record<string, string> = {
  targetCpa: '상담 1건을 얻기 위해 허용하는 최대 광고비입니다. 낮을수록 보수적, 높을수록 공격적으로 운영됩니다.',
  maxBid: '이 금액을 넘겨서 입찰하지 않습니다. 경쟁 입찰가보다 낮으면 목표 순위 달성이 어려울 수 있습니다.',
  minBid: '이 금액 이하로는 내리지 않습니다. 네이버 최소 입찰가는 70원입니다.',
  targetRank: '몇 위에 광고를 노출할지 설정합니다. 1위는 최대 노출, 5위 이상은 비용 절감에 유리합니다.',
};

const STRATEGY_DETAILS: Record<string, string> = {
  grade: '키워드를 S/A/B 등급으로 분류하여 각 등급별로 다른 CPA 목표와 입찰가를 적용합니다.\nS등급(분양 직접 키워드)에는 높은 입찰가를, B등급(경쟁 탐색)에는 낮은 입찰가를 설정해 광고비를 효율적으로 배분합니다.',
  target_rank: '설정한 순위를 유지하도록 10분마다 자동으로 입찰가를 조정합니다.\n경쟁사가 입찰가를 올리면 우리도 올리고, 내리면 우리도 내려 CPC를 절감합니다.',
  smart: 'CPA 목표를 지키면서 최대한 높은 순위를 유지하는 복합 전략입니다.\n전환이 많은 키워드는 공격적으로, 전환이 없는 키워드는 보수적으로 운영합니다.',
};

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <HelpCircle
        className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help inline ml-1"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-[11px] rounded-lg shadow-lg whitespace-pre-wrap w-[220px] leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
}

export default function AdAutomation({ adAccountId }: AdAutomationProps) {
  const { account, groupSettings, saveGroupSetting, updateAccount } = useAdAccount();
  const { selectedStrategy, setSelectedStrategy: setStoreStrategy } = useAdStore();
  const [strategy, setStrategyLocal] = useState(account?.strategy || selectedStrategy || 'grade');
  const setStrategy = (v: string) => { setStrategyLocal(v); setStoreStrategy(v); };
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [groups, setGroups] = useState<Record<string, { targetCpa: number; maxBid: number; minBid: number; targetRank: number }>>({});
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ success: boolean; message: string; details?: ChangeDetail[] } | null>(null);
  const [bidLogs, setBidLogs] = useState<BidLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [aiRecs, setAiRecs] = useState<AiRecommendation[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showRunAfterSave, setShowRunAfterSave] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryResult, setDryResult] = useState<ChangeDetail[] | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [competitorData, setCompetitorData] = useState<Record<string, GroupCompetitorData>>({});
  const [blockedGroups, setBlockedGroups] = useState<BlockedGroup[]>([]);

  // 입찰 전략 상세설정
  const [strategyMode, setStrategyMode] = useState<'simple' | 'advanced' | 'smart'>('simple');
  const [simpleStrategy, setSimpleStrategy] = useState({ targetRank: 1, maxBid: 6000 });
  const [advancedStrategy, setAdvancedStrategy] = useState<Record<string, { targetRank: number; maxBid: number }>>({
    qi7: { targetRank: 1, maxBid: 4000 },
    qi5: { targetRank: 2, maxBid: 5000 },
    qi3: { targetRank: 3, maxBid: 6000 },
    qi1: { targetRank: 5, maxBid: 3000 },
  });
  const [smartStrategy, setSmartStrategy] = useState({ conversionTargetRank: 1, noConversionTargetRank: 3 });

  const saveStrategy = async () => {
    if (!adAccountId) return;
    const { error } = await supabase.from('ad_group_settings').upsert({
      ncc_adgroup_id: 'grp-a001-01-000000064160803',
      strategy_mode: strategyMode,
      simple_strategy: simpleStrategy,
      advanced_strategy: advancedStrategy,
      smart_strategy: smartStrategy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ncc_adgroup_id' });
    if (!error) toast.success('전략 저장됨');
    else toast.error('저장 실패');
  };

  // 실시간 순위 모니터링 (rank_logs 테이블)
  const [rankSnapshots, setRankSnapshots] = useState<Array<{ keyword: string; rank: number; totalAds: number; createdAt: string }>>([]);
  const fetchRankSnapshots = useCallback(async () => {
    const brandKeywords = ['송도월드메르디앙', '송도월드메르디앙분양', '월드메르디앙', '월드메르디앙송도'];
    try {
      // 각 키워드의 가장 최근 rank_logs 1건
      const results = await Promise.all(brandKeywords.map(async kw => {
        const { data } = await supabase
          .from('rank_logs')
          .select('keyword, rank, total_ads, created_at')
          .eq('keyword', kw)
          .order('created_at', { ascending: false })
          .limit(1);
        const row = (data || [])[0];
        return row ? { keyword: kw, rank: row.rank, totalAds: row.total_ads, createdAt: row.created_at } : { keyword: kw, rank: -1, totalAds: 0, createdAt: '' };
      }));
      setRankSnapshots(results);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    fetchRankSnapshots();
    const t = setInterval(fetchRankSnapshots, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchRankSnapshots]);

  // URL param ?highlight=<groupName> → 해당 그룹 카드 maxBid 필드 강조
  const [searchParams] = useSearchParams();
  const highlightGroup = searchParams.get('highlight');
  const maxBidRefs = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    if (highlightGroup && maxBidRefs.current[highlightGroup]) {
      maxBidRefs.current[highlightGroup]?.focus();
      maxBidRefs.current[highlightGroup]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightGroup, groups]);

  // 경쟁 입찰가 백그라운드 조회
  const fetchCompetitorData = useCallback(async () => {
    if (!adAccountId) return;
    try {
      const campaigns = (await fetchCampaigns(adAccountId)).filter(c => c.status === 'ELIGIBLE');
      const allAgs = (await Promise.all(campaigns.map(c => fetchAdGroups(adAccountId!, c.nccCampaignId)))).flat();

      for (const ag of allAgs) {
        setCompetitorData(prev => ({ ...prev, [ag.name]: { keywords: [], avg: {}, loading: true } }));
        const keywords = await fetchKeywords(adAccountId!, ag.nccAdgroupId);
        if (keywords.length === 0) {
          setCompetitorData(prev => ({ ...prev, [ag.name]: { keywords: [], avg: {}, loading: false } }));
          continue;
        }

        // 대표 키워드 5개만 조회
        const sample = keywords.slice(0, 5);
        const kwData: GroupCompetitorData['keywords'] = [];
        for (let i = 0; i < sample.length; i += 5) {
          const batch = sample.slice(i, i + 5);
          const results = await Promise.all(batch.map(async kw => {
            try {
              const est = await fetchBidEstimates(adAccountId!, kw.nccKeywordId, kw.keyword);
              return { keyword: kw.keyword, bid: kw.bidAmt, rankBids: estimateToRankBids(est) };
            } catch { return { keyword: kw.keyword, bid: kw.bidAmt, rankBids: {} as Record<number, number> }; }
          }));
          kwData.push(...results);
        }

        // 순위별 평균 계산
        const avg: Record<number, number> = {};
        for (const rank of [1, 3, 5, 7]) {
          const vals = kwData.map(k => k.rankBids[rank]).filter(Boolean);
          if (vals.length > 0) avg[rank] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        }

        setCompetitorData(prev => ({ ...prev, [ag.name]: { keywords: kwData, avg, loading: false } }));
      }
    } catch (e) {
      console.error('경쟁 입찰가 조회 실패:', e);
    }
  }, [adAccountId]);

  useEffect(() => {
    if (adAccountId) fetchCompetitorData();
  }, [adAccountId, fetchCompetitorData]);

  useEffect(() => {
    const map: typeof groups = {};
    for (const dg of DEFAULT_GROUPS) {
      const existing = groupSettings.find(g => g.groupName === dg.group_name);
      map[dg.group_name] = existing
        ? { targetCpa: existing.targetCpa, maxBid: existing.maxBid, minBid: existing.minBid, targetRank: existing.targetRank }
        : { targetCpa: dg.target_cpa, maxBid: dg.max_bid, minBid: dg.min_bid, targetRank: dg.target_rank };
    }
    setGroups(map);
  }, [groupSettings]);

  useEffect(() => {
    if (account) setStrategy(account.strategy);
  }, [account]);

  const fetchLogs = useCallback(async () => {
    if (!adAccountId) return;
    setLogsLoading(true);
    try {
      const { data } = await supabase
        .from('ad_bid_logs')
        .select('*')
        .eq('ad_account_id', adAccountId)
        .order('created_at', { ascending: false })
        .limit(10);
      const mapped = (data || []).map((r: AdBidLogRow) => ({
        id: r.id,
        strategy: r.strategy,
        totalKeywords: r.total_keywords,
        totalChanged: r.total_changed,
        totalSkipped: r.total_skipped,
        avgBid: r.avg_bid,
        elapsedMs: r.elapsed_ms,
        createdAt: r.created_at,
        details: r.details as BidLog['details'],
      }));
      setBidLogs(mapped);
      // 최신 로그의 blockedGroups 추출
      const latest = mapped[0];
      setBlockedGroups(latest?.details?.blockedGroups || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  }, [adAccountId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // AI 추천
  const handleAiRecommend = async () => {
    if (!adAccountId) return;
    setAiLoading(true);
    setAiRecs([]);
    try {
      const campaigns = (await fetchCampaigns(adAccountId)).filter(c => c.status === 'ELIGIBLE');
      const allAgs = (await Promise.all(campaigns.map(c => fetchAdGroups(adAccountId!, c.nccCampaignId)))).flat();
      const recs: AiRecommendation[] = [];

      for (const ag of allAgs) {
        const keywords = await fetchKeywords(adAccountId!, ag.nccAdgroupId);
        if (keywords.length === 0) continue;

        const sample = keywords.slice(0, 3);
        const estimates = await Promise.all(sample.map(async kw => {
          try {
            const est = await fetchBidEstimates(adAccountId!, kw.nccKeywordId, kw.keyword);
            return { keyword: kw.keyword, bid: kw.bidAmt, rankBids: estimateToRankBids(est) };
          } catch { return { keyword: kw.keyword, bid: kw.bidAmt, rankBids: {} as Record<number, number> }; }
        }));

        const currentGroup = groups[ag.name];
        const targetRank = currentGroup?.targetRank || DEFAULT_TARGET_RANKS[ag.name] || 5;
        const reasons: string[] = [];
        const effects: string[] = [];

        const avgBid = Math.round(keywords.reduce((s, k) => s + k.bidAmt, 0) / keywords.length);
        const rankBidValues = estimates.map(e => e.rankBids[targetRank]).filter(Boolean);
        const avgRankBid = rankBidValues.length > 0 ? Math.round(rankBidValues.reduce((a, b) => a + b, 0) / rankBidValues.length) : 0;
        const rank1Values = estimates.map(e => e.rankBids[1]).filter(Boolean);
        const avgRank1 = rank1Values.length > 0 ? Math.round(rank1Values.reduce((a, b) => a + b, 0) / rank1Values.length) : 0;

        let recMaxBid = currentGroup?.maxBid || 1000;
        let recTargetRank = targetRank;

        reasons.push(`현재 평균 입찰가: ${avgBid.toLocaleString()}원`);
        if (avgRankBid > 0) reasons.push(`${targetRank}위 평균 입찰가: ${avgRankBid.toLocaleString()}원`);

        if (avgRankBid > 0 && avgBid < avgRankBid * 0.8) {
          reasons.push(`현재 입찰가(${avgBid.toLocaleString()}원)로 노출 부족`);
          recMaxBid = Math.max(recMaxBid, Math.round(avgRankBid * 1.1 / 100) * 100);
          effects.push(`노출수 +30~50% 예상`);
        } else if (avgRankBid > 0 && avgBid > avgRankBid * 1.3) {
          reasons.push(`현재 입찰가가 과도하게 높음`);
          recMaxBid = Math.round(avgRankBid * 1.1 / 100) * 100;
          effects.push(`비용 절감 -20~30% 예상`);
        }

        if (ag.name === '브랜드_방어' && avgRank1 > 0 && recMaxBid < avgRank1) {
          reasons.push(`브랜드 방어 1위 필수 — 1위 입찰가 ${avgRank1.toLocaleString()}원`);
          recMaxBid = Math.round(avgRank1 * 1.1 / 100) * 100;
          recTargetRank = 1;
        }

        const estDailyCost = keywords.length * (avgRankBid || avgBid) * 0.01;
        effects.push(`일 예상 광고비: 약 ${Math.round(estDailyCost).toLocaleString()}원`);
        effects.push(`예상 클릭수: +${Math.max(1, Math.round(keywords.length * 0.05))}회/일`);

        recs.push({ groupName: ag.name, targetRank: recTargetRank, maxBid: recMaxBid, reasons, effects });
      }
      setAiRecs(recs);
      if (recs.length === 0) toast.info('분석할 광고그룹이 없습니다');
    } catch (e) {
      toast.error(`AI 분석 실패: ${(e as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiRec = (rec: AiRecommendation) => {
    setGroups(prev => ({
      ...prev,
      [rec.groupName]: { ...prev[rec.groupName], targetRank: rec.targetRank, maxBid: rec.maxBid },
    }));
    toast.success(`${rec.groupName} 설정 적용됨`);
  };

  const handleSave = async () => {
    if (!adAccountId) return;
    setSaving(true);
    try {
      await updateAccount({ strategy } as Partial<AdGroupSettingRow> & { strategy: string });
      for (const [groupName, settings] of Object.entries(groups)) {
        await saveGroupSetting({
          ad_account_id: adAccountId,
          group_name: groupName,
          target_cpa: settings.targetCpa,
          max_bid: settings.maxBid,
          min_bid: settings.minBid,
          target_rank: settings.targetRank,
          daily_budget: null,
          is_auto: true,
        } as Omit<AdGroupSettingRow, 'id' | 'created_at'>);
      }
      toast.success('설정이 저장되었습니다');
      setShowRunAfterSave(true);
    } catch (e) {
      toast.error('저장 실패');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // [지금 실행]
  const handleRunNow = async () => {
    if (!adAccountId) return;
    setRunning(true);
    setRunResult(null);
    setShowRunAfterSave(false);
    const startTime = Date.now();

    try {
      const isTargetRank = strategy === 'target_rank';
      const timeInfo = getTimeMultiplier();
      const gsMap: Record<string, { targetCpa: number; maxBid: number; minBid: number }> = {};
      const trMap: Record<string, number> = { ...DEFAULT_TARGET_RANKS };
      for (const [name, g] of Object.entries(groups)) {
        gsMap[name] = { targetCpa: g.targetCpa, maxBid: g.maxBid, minBid: g.minBid };
        trMap[name] = g.targetRank;
      }

      setProgress('캠페인 조회 중...');
      const campaigns = (await fetchCampaigns(adAccountId)).filter(c => c.status === 'ELIGIBLE');
      if (campaigns.length === 0) throw new Error('활성 캠페인이 없습니다');

      setProgress(`광고그룹 조회 중...`);
      const allAdGroups = (await Promise.all(campaigns.map(c => fetchAdGroups(adAccountId!, c.nccCampaignId)))).flat();

      const allChanges: ChangeDetail[] = [];
      let totalKeywords = 0, totalChanged = 0, totalSkipped = 0, bidSum = 0;

      for (const ag of allAdGroups) {
        const gs = gsMap[ag.name] || { targetCpa: 30000, maxBid: 1000, minBid: 70 };
        const targetRank = trMap[ag.name] ?? 5;
        const groupBid = ag.bidAmt;

        setProgress(`[${ag.name}] 키워드 조회 중...`);
        const keywords = await fetchKeywords(adAccountId!, ag.nccAdgroupId);
        if (keywords.length === 0) continue;
        totalKeywords += keywords.length;

        setProgress(`[${ag.name}] 성과/경쟁입찰가 조회 중... (${keywords.length}개)`);
        const [statsArr, estimateResults] = await Promise.all([
          fetchKeywordStats(adAccountId!, keywords.map(k => k.nccKeywordId)),
          isTargetRank
            ? (async () => {
                const results: { keyword: string; rankBids: Record<number, number> }[] = [];
                for (let i = 0; i < keywords.length; i += 5) {
                  const batch = keywords.slice(i, i + 5);
                  const br = await Promise.all(batch.map(async kw => {
                    try {
                      const est = await fetchBidEstimates(adAccountId!, kw.nccKeywordId, kw.keyword);
                      return { keyword: kw.keyword, rankBids: estimateToRankBids(est) };
                    } catch { return { keyword: kw.keyword, rankBids: {} as Record<number, number> }; }
                  }));
                  results.push(...br);
                }
                return results;
              })()
            : Promise.resolve([] as { keyword: string; rankBids: Record<number, number> }[]),
        ]);

        const statsMap: Record<string, KeywordStatRow[]> = {};
        for (const stat of statsArr) { if (!statsMap[stat.id]) statsMap[stat.id] = []; statsMap[stat.id].push(stat); }
        const estimateMap: Record<string, Record<number, number>> = {};
        for (const er of estimateResults) { estimateMap[er.keyword] = er.rankBids; }

        const updates: { id: string; bid: number; agId: string }[] = [];
        for (const kw of keywords) {
          const agg = aggregateStats(statsMap[kw.nccKeywordId] || []);
          const effectiveBid = kw.useGroupBidAmt ? groupBid : kw.bidAmt;
          let result = isTargetRank
            ? calculateBidByTargetRank(effectiveBid, agg.avgRank, targetRank, estimateMap[kw.keyword] || {}, gs, kw.nccQi?.qiGrade)
            : calculateOptimalBid(effectiveBid, agg, gs);

          if (timeInfo.multiplier !== 1.0) {
            const before = result.newBid;
            result.newBid = Math.round(result.newBid * timeInfo.multiplier / 10) * 10;
            result.newBid = Math.min(result.newBid, gs.maxBid);
            result.newBid = Math.max(result.newBid, gs.minBid);
            if (result.newBid !== before) result.reason += ` [${timeInfo.slotName}${timeInfo.multiplier}x]`;
          }

          bidSum += result.newBid;
          const changed = Math.abs(result.newBid - result.currentBid) >= 10;
          if (changed) { updates.push({ id: kw.nccKeywordId, bid: result.newBid, agId: ag.nccAdgroupId }); totalChanged++; }
          else { totalSkipped++; }
          allChanges.push({ keyword: kw.keyword, adGroup: ag.name, currentBid: result.currentBid, newBid: result.newBid, reason: result.reason, changed });
        }

        if (updates.length > 0) {
          setProgress(`[${ag.name}] ${updates.length}개 키워드 입찰가 변경 중...`);
          for (let i = 0; i < updates.length; i += 5) {
            const batch = updates.slice(i, i + 5);
            await Promise.all(batch.map(u => updateKeywordBid(adAccountId!, u.id, u.bid, u.agId)));
          }
        }
      }

      const elapsedMs = Date.now() - startTime;
      const avgBid = totalKeywords > 0 ? Math.round(bidSum / totalKeywords) : 0;

      await supabase.from('ad_bid_logs').insert({
        ad_account_id: adAccountId, strategy,
        total_keywords: totalKeywords, total_changed: totalChanged, total_skipped: totalSkipped,
        avg_bid: avgBid, elapsed_ms: elapsedMs,
        details: { changes: allChanges.filter(c => c.changed).slice(0, 50) },
      });

      setRunResult({ success: true, message: `실행 완료! ${totalChanged}개 변경 (총 ${totalKeywords}개), ${(elapsedMs / 1000).toFixed(1)}초`, details: allChanges.filter(c => c.changed) });
      toast.success(`자동화 실행 완료: ${totalChanged}개 변경`);
      fetchLogs();
    } catch (e) {
      const elapsedMs = Date.now() - startTime;
      await supabase.from('ad_bid_logs').insert({
        ad_account_id: adAccountId, strategy,
        total_keywords: 0, total_changed: 0, total_skipped: 0, avg_bid: 0, elapsed_ms: elapsedMs,
        details: { error: (e as Error).message },
      });
      setRunResult({ success: false, message: `실행 실패: ${(e as Error).message}` });
      toast.error('자동화 실행 실패');
      fetchLogs();
    } finally {
      setRunning(false);
      setProgress('');
    }
  };

  // 시뮬레이션 (드라이런) — 실제 변경 없이 미리보기
  const handleDryRun = async () => {
    if (!adAccountId) return;
    setDryRunning(true); setDryResult(null);
    try {
      const isTargetRank = strategy === 'target_rank';
      const timeInfo = getTimeMultiplier();
      const gsMap: Record<string, { targetCpa: number; maxBid: number; minBid: number }> = {};
      const trMap: Record<string, number> = { ...DEFAULT_TARGET_RANKS };
      for (const [name, g] of Object.entries(groups)) {
        gsMap[name] = { targetCpa: g.targetCpa, maxBid: g.maxBid, minBid: g.minBid };
        trMap[name] = g.targetRank;
      }
      setProgress('시뮬레이션: 캠페인 조회 중...');
      const campaigns = (await fetchCampaigns(adAccountId)).filter(c => c.status === 'ELIGIBLE');
      const allAgs = (await Promise.all(campaigns.map(c => fetchAdGroups(adAccountId!, c.nccCampaignId)))).flat();
      const changes: ChangeDetail[] = [];
      for (const ag of allAgs) {
        const gs = gsMap[ag.name] || { targetCpa: 30000, maxBid: 1000, minBid: 70 };
        const targetRank = trMap[ag.name] ?? 5;
        setProgress(`시뮬레이션: [${ag.name}] 분석 중...`);
        const keywords = await fetchKeywords(adAccountId!, ag.nccAdgroupId);
        if (keywords.length === 0) continue;
        const keywordIds = keywords.map(k => k.nccKeywordId);
        const [statsArr, estimateResults] = await Promise.all([
          fetchKeywordStats(adAccountId!, keywordIds),
          isTargetRank ? (async () => {
            const results: { keyword: string; rankBids: Record<number, number> }[] = [];
            for (let i = 0; i < keywords.length; i += 5) {
              const batch = keywords.slice(i, i + 5);
              const br = await Promise.all(batch.map(async kw => {
                try { const est = await fetchBidEstimates(adAccountId!, kw.nccKeywordId, kw.keyword); return { keyword: kw.keyword, rankBids: estimateToRankBids(est) }; }
                catch { return { keyword: kw.keyword, rankBids: {} as Record<number, number> }; }
              }));
              results.push(...br);
            }
            return results;
          })() : Promise.resolve([] as { keyword: string; rankBids: Record<number, number> }[]),
        ]);
        const statsMap: Record<string, any[]> = {};
        for (const stat of statsArr) { if (!statsMap[stat.id]) statsMap[stat.id] = []; statsMap[stat.id].push(stat); }
        const estimateMap: Record<string, Record<number, number>> = {};
        for (const er of estimateResults) estimateMap[er.keyword] = er.rankBids;
        for (const kw of keywords) {
          const dailyStats = statsMap[kw.nccKeywordId] || [];
          const agg = aggregateStats(dailyStats);
          const effectiveBid = kw.useGroupBidAmt ? ag.bidAmt : kw.bidAmt;
          let result;
          if (isTargetRank) { result = calculateBidByTargetRank(effectiveBid, agg.avgRank, targetRank, estimateMap[kw.keyword] || {}, gs, kw.nccQi?.qiGrade); }
          else { result = calculateOptimalBid(effectiveBid, agg, gs); }
          if (timeInfo.multiplier !== 1.0) {
            result.newBid = Math.round(result.newBid * timeInfo.multiplier / 10) * 10;
            result.newBid = Math.min(result.newBid, gs.maxBid);
            result.newBid = Math.max(result.newBid, gs.minBid);
          }
          const changed = Math.abs(result.newBid - result.currentBid) >= 10;
          if (changed) changes.push({ keyword: kw.keyword, adGroup: ag.name, currentBid: result.currentBid, newBid: result.newBid, reason: result.reason, changed: true });
        }
      }
      setDryResult(changes);
    } catch (e) { toast.error(`시뮬레이션 실패: ${(e as Error).message}`); }
    finally { setDryRunning(false); setProgress(''); }
  };

  const handleApplyDryRun = async () => {
    if (!dryResult || !adAccountId) return;
    // 실제 적용은 handleRunNow와 동일하게 실행
    setDryResult(null);
    handleRunNow();
  };

  // 설정값 실시간 피드백 (경쟁 입찰가 데이터 활용)
  const getFieldHint = (groupName: string, key: string, value: number): { text: string; type: 'ok' | 'warn' | 'info' } | null => {
    const g = groups[groupName];
    if (!g) return null;
    const cd = competitorData[groupName];
    const avg = cd?.avg || {};

    if (key === 'targetCpa') {
      const dailyBudget = 10000;
      const convPerDay = dailyBudget / value;
      if (convPerDay < 0.5) return { text: `일예산 ${dailyBudget.toLocaleString()}원 기준 하루 ${convPerDay.toFixed(1)}건 — 1건도 어려울 수 있어요`, type: 'warn' };
      return { text: `일예산 기준 약 ${convPerDay.toFixed(1)}건/일 전환 가능`, type: 'ok' };
    }

    if (key === 'targetRank') {
      if (value <= 0 || value > 15) return { text: '1~15 사이로 설정해주세요', type: 'warn' };
      const rankBid = avg[value] || avg[value <= 3 ? 3 : value <= 5 ? 5 : 7];
      if (rankBid) {
        const canAchieve = g.maxBid >= rankBid;
        return { text: `${value}위 필요 입찰가: 약 ${rankBid.toLocaleString()}원 — ${canAchieve ? '현재 설정으로 달성 가능' : `최대입찰가를 ${rankBid.toLocaleString()}원 이상으로 올려주세요`}`, type: canAchieve ? 'ok' : 'warn' };
      }
      if (value <= 3) return { text: '상위 노출 — 클릭률 높지만 비용 증가', type: 'info' };
      if (value <= 5) return { text: '적정 순위 — 비용 대비 효율적', type: 'ok' };
      return { text: '하위 노출 — 비용 절감, 노출 제한', type: 'info' };
    }

    if (key === 'maxBid') {
      if (value < g.minBid) return { text: '최소 입찰가보다 낮습니다', type: 'warn' };
      const rank1 = avg[1], rank3 = avg[3];
      if (rank1 && value >= rank1) return { text: `1위 평균(${rank1.toLocaleString()}원) 이상 — 1위도 가능`, type: 'ok' };
      if (rank3 && value >= rank3) return { text: `3위 평균(${rank3.toLocaleString()}원) 이상 — 3위 달성 가능`, type: 'ok' };
      if (rank3 && value < rank3) return { text: `3위 평균(${rank3.toLocaleString()}원)보다 낮아 목표순위 달성 어려움`, type: 'warn' };
      if (value < 200) return { text: '입찰가가 너무 낮아 노출이 어려울 수 있어요', type: 'warn' };
    }

    if (key === 'minBid') {
      if (value < 70) return { text: '네이버 최소 입찰가는 70원입니다', type: 'warn' };
      if (value > g.maxBid) return { text: '최대 입찰가보다 높습니다', type: 'warn' };
    }

    return null;
  };

  if (!adAccountId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Zap className="w-5 h-5" />자동화 설정
          <HelpTooltip
            title="자동입찰 엔진"
            auto="3분마다 실행. 경쟁사 1위 입찰가 × 품질지수 버퍼 계산 → 네이버 입찰가 자동 변경. 모든 결정 이유 기록."
            manual="최대 입찰가(max_bid)와 목표 순위 설정. 설정 후 방치해도 됨."
          />
        </h2>
        <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-muted-foreground">광고 계정을 먼저 설정해주세요.</div>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-3 p-4">
      {/* ====== 헤더: 제목 + 우측 액션 버튼 3개 ====== */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Zap className="w-5 h-5" />자동화 설정
          <HelpTooltip
            title="자동입찰 엔진"
            auto="3분마다 실행. 경쟁사 1위 입찰가 × 품질지수 버퍼 계산 → 네이버 입찰가 자동 변경. 모든 결정 이유 기록."
            manual="최대 입찰가(max_bid)와 목표 순위 설정. 설정 후 방치해도 됨."
          />
        </h2>
        <div className="flex gap-2">
          <button onClick={handleAiRecommend} disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50">
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            AI추천
          </button>
          <button onClick={handleDryRun} disabled={dryRunning || running}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-500 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-50 disabled:opacity-50">
            {dryRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>🔍</span>}
            시뮬레이션
          </button>
          <button onClick={handleRunNow} disabled={running || dryRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? '실행 중' : '지금실행'}
          </button>
        </div>
      </div>

      {/* ====== 상단 1열: 자동모드 토글 + 전략 3종 ====== */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {/* 자동 모드 카드 */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              완전 자동 모드
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">10분마다 AI 자동 최적화</div>
          </div>
          <button
            onClick={async () => {
              try {
                const next = !account?.isAuto;
                await updateAccount({ is_auto: next });
                toast.success(next ? '완전 자동 모드 ON' : '완전 자동 모드 OFF');
              } catch (e) { toast.error(`변경 실패: ${(e as Error).message}`); }
            }}
            className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${account?.isAuto ? 'bg-purple-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${account?.isAuto ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {/* 입찰 전략 카드 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 col-span-2">
          <div className="text-sm font-bold text-slate-800 mb-2">📊 입찰 전략</div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'grade', l: '등급별 자동' },
              { v: 'target_rank', l: '목표 순위' },
              { v: 'smart', l: '스마트' },
            ] as const).map(s => (
              <button key={s.v}
                onClick={() => setStrategy(s.v)}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                  strategy === s.v
                    ? 'bg-[#093687] text-white border-[#093687]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ====== 입찰 전략 상세설정 ====== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-800 flex items-center">
            입찰 전략 상세설정
            <HelpTooltip
              title="입찰 전략"
              auto="QI 등급별로 다른 목표순위와 최대입찰가를 자동 적용합니다"
              manual="각 등급별 목표순위와 최대입찰가를 설정하세요"
            />
          </h3>
          <div className="flex gap-1">
            {([
              { k: 'simple' as const, l: '단순', c: 'bg-blue-600' },
              { k: 'advanced' as const, l: '등급별', c: 'bg-blue-600' },
              { k: 'smart' as const, l: '스마트', c: 'bg-purple-600' },
            ]).map(m => (
              <button key={m.k} onClick={() => setStrategyMode(m.k)}
                className={`px-3 py-1 text-xs rounded transition-colors ${strategyMode === m.k ? `${m.c} text-white` : 'bg-gray-100 text-gray-600'}`}>
                {m.l}
              </button>
            ))}
          </div>
        </div>

        {strategyMode === 'simple' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">목표 순위</label>
              <input type="number" min={1} max={15} value={simpleStrategy.targetRank}
                onChange={e => setSimpleStrategy(p => ({ ...p, targetRank: +e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">최대 입찰가 (원)</label>
              <input type="number" step={100} value={simpleStrategy.maxBid}
                onChange={e => setSimpleStrategy(p => ({ ...p, maxBid: +e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        {strategyMode === 'advanced' && (
          <div className="space-y-2">
            {([
              { label: 'QI 7 (양호)', color: 'bg-green-400', key: 'qi7' },
              { label: 'QI 5~6 (보통 이상)', color: 'bg-yellow-400', key: 'qi5' },
              { label: 'QI 3~4 (보통)', color: 'bg-orange-400', key: 'qi3' },
              { label: 'QI 1~2 (개선필요)', color: 'bg-red-400', key: 'qi1' },
            ]).map(({ label, color, key }) => (
              <div key={key} className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">목표순위</label>
                  <input type="number" min={1} max={15} value={advancedStrategy[key]?.targetRank || 1}
                    onChange={e => setAdvancedStrategy(p => ({ ...p, [key]: { ...p[key], targetRank: +e.target.value } }))}
                    className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">최대입찰가</label>
                  <input type="number" step={100} value={advancedStrategy[key]?.maxBid || 6000}
                    onChange={e => setAdvancedStrategy(p => ({ ...p, [key]: { ...p[key], maxBid: +e.target.value } }))}
                    className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                </div>
              </div>
            ))}
          </div>
        )}

        {strategyMode === 'smart' && (
          <div className="space-y-3">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700">
              스마트 모드: 전환(방문예약) 이력이 있는 키워드는 입찰가를 높이고, 노출만 있고 전환이 없는 키워드는 입찰가를 낮춥니다.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">전환 있는 키워드 목표순위</label>
                <input type="number" min={1} max={5} value={smartStrategy.conversionTargetRank}
                  onChange={e => setSmartStrategy(p => ({ ...p, conversionTargetRank: +e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">전환 없는 키워드 목표순위</label>
                <input type="number" min={1} max={10} value={smartStrategy.noConversionTargetRank}
                  onChange={e => setSmartStrategy(p => ({ ...p, noConversionTargetRank: +e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        )}

        <button onClick={saveStrategy}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          전략 저장
        </button>
      </div>

      {/* ====== 진행/결과 메시지 (컴팩트) ====== */}
      {running && progress && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-blue-50 border border-blue-200 text-blue-700">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />{progress}
        </div>
      )}
      {runResult && !running && (
        <div className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${runResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {runResult.success ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{runResult.message}</span>
          <button onClick={() => setRunResult(null)} className="ml-auto text-[10px] underline">닫기</button>
        </div>
      )}

      {/* ====== 목표순위 달성 불가 알림 ====== */}
      {blockedGroups.length > 0 && (
        <div className="shrink-0 rounded-xl border border-red-300 bg-red-50 p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700 mb-1">⚠️ 목표순위 달성 불가</p>
            <div className="space-y-1">
              {blockedGroups.map(b => (
                <p key={b.groupName} className="text-xs text-red-700">
                  <span className="font-semibold">{b.groupName}</span> · 목표 {b.targetRank}위 / 현재 {b.currentRank}위 · 필요 입찰가{' '}
                  <span className="font-bold">{b.requiredBid.toLocaleString()}원</span> (현재 최대 {b.currentMaxBid.toLocaleString()}원)
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====== 키워드별 개별 자동화 설정 (보라웨어식 테이블) ====== */}
      {adAccountId && <KeywordAutomationTable adAccountId={adAccountId} />}

      {/* ====== 그룹 기본값 저장 (fallback/신규 키워드용) ====== */}
      <details className="bg-white border border-slate-200 rounded-xl">
        <summary className="px-4 py-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50">
          등급별 기본 설정 (신규 키워드 적용값) — {Object.keys(groups).length}개 그룹
        </summary>
        <div className="p-3 space-y-2 border-t border-slate-100">
          {DEFAULT_GROUPS.map(dg => {
            const g = groups[dg.group_name] || { targetCpa: dg.target_cpa, maxBid: dg.max_bid, minBid: dg.min_bid, targetRank: dg.target_rank };
            return (
              <div key={dg.group_name} className="grid grid-cols-5 gap-2 items-center text-xs">
                <span className="font-semibold text-[#093687]">{dg.group_name}</span>
                <input type="number" value={g.targetCpa} onChange={e => setGroups(prev => ({ ...prev, [dg.group_name]: { ...prev[dg.group_name], targetCpa: Number(e.target.value) } }))} className="px-2 py-1 border border-slate-200 rounded" placeholder="목표 CPA" />
                <input type="number" value={g.maxBid} onChange={e => setGroups(prev => ({ ...prev, [dg.group_name]: { ...prev[dg.group_name], maxBid: Number(e.target.value) } }))} className="px-2 py-1 border border-slate-200 rounded" placeholder="max 입찰" />
                <input type="number" value={g.minBid} onChange={e => setGroups(prev => ({ ...prev, [dg.group_name]: { ...prev[dg.group_name], minBid: Number(e.target.value) } }))} className="px-2 py-1 border border-slate-200 rounded" placeholder="min 입찰" />
                <input type="number" value={g.targetRank} onChange={e => setGroups(prev => ({ ...prev, [dg.group_name]: { ...prev[dg.group_name], targetRank: Number(e.target.value) } }))} className="px-2 py-1 border border-slate-200 rounded" placeholder="목표 순위" />
              </div>
            );
          })}
          <button onClick={handleSave} disabled={saving}
            className="w-full mt-2 bg-[#093687] text-white py-2 rounded-lg text-xs font-bold hover:bg-[#072b6e] disabled:opacity-50 flex items-center justify-center gap-2">
            <Save className="w-3.5 h-3.5" />
            {saving ? '저장 중...' : '그룹 기본값 저장'}
          </button>
        </div>
      </details>

      {/* ====== 실시간 순위 모니터링 (브랜드 키워드) ====== */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-800">📍 실시간 순위 — 브랜드 키워드 (3분 주기)</span>
          <button onClick={fetchRankSnapshots} className="text-[11px] text-slate-400 hover:text-slate-600">새로고침</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {rankSnapshots.map(snap => {
            const brandTargetRank = groups['브랜드_방어']?.targetRank || 1;
            const achieved = snap.rank > 0 && snap.rank <= brandTargetRank;
            const badgeColor =
              snap.rank === -1 ? 'text-slate-400' :
              snap.rank === 0 ? 'text-red-600' :
              achieved ? 'text-green-600' :
              snap.rank <= 3 ? 'text-blue-600' : 'text-amber-600';
            const rankText =
              snap.rank === -1 ? '-' :
              snap.rank === 0 ? '미노출' :
              `${snap.rank}위`;
            return (
              <div key={snap.keyword} className="rounded-lg border border-slate-200 p-2">
                <div className="text-[11px] text-slate-500 truncate" title={snap.keyword}>{snap.keyword}</div>
                <div className={`text-xl font-bold mt-1 ${badgeColor}`}>{rankText}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  목표 {brandTargetRank}위 · 광고 {snap.totalAds}개
                </div>
                {snap.createdAt && (
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {new Date(snap.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ====== 하단 2열: 시간대 배율 + 실행 로그 ====== */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        {/* 시간대 배율 — 기존 TimeStrategy 컴포넌트 내장 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-hidden">
          <TimeStrategy adAccountId={adAccountId} />
        </div>

        {/* 실행 로그 (컴팩트) + reason 통계 */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />실행 로그 + reason 통계
            </span>
            <button onClick={fetchLogs} className="text-[11px] text-slate-400 hover:text-slate-600">새로고침</button>
          </div>

          {/* reason 통계 (최근 12건 로그 기준) */}
          {bidLogs.length > 0 && (() => {
            const stat = { compUp: 0, compDown: 0, compKeep: 0, rankUp: 0, rankDown: 0, noImp: 0, other: 0 };
            for (const log of bidLogs.slice(0, 12)) {
              const changes = (log.details as { changes?: Array<{ reason: string; currentBid: number; newBid: number; changed: boolean }> } | undefined)?.changes || [];
              for (const c of changes) {
                if (!c.changed) continue;
                const r = c.reason || '';
                const isComp = r.includes('경쟁사기반');
                const up = c.newBid > c.currentBid;
                const down = c.newBid < c.currentBid;
                if (isComp && up) stat.compUp++;
                else if (isComp && down) stat.compDown++;
                else if (isComp) stat.compKeep++;
                else if (r.includes('순위올림')) stat.rankUp++;
                else if (r.includes('비용절감')) stat.rankDown++;
                else if (r.includes('노출없음')) stat.noImp++;
                else stat.other++;
              }
            }
            return (
              <div className="mb-2 grid grid-cols-3 gap-1 text-[10px] shrink-0">
                <div className="rounded bg-blue-50 border border-blue-100 px-1.5 py-1 text-blue-700">경쟁↑ <b>{stat.compUp}</b></div>
                <div className="rounded bg-orange-50 border border-orange-100 px-1.5 py-1 text-orange-700">경쟁↓ <b>{stat.compDown}</b></div>
                <div className="rounded bg-slate-50 border border-slate-200 px-1.5 py-1 text-slate-600">경쟁= <b>{stat.compKeep}</b></div>
                <div className="rounded bg-purple-50 border border-purple-100 px-1.5 py-1 text-purple-700">순위↑ <b>{stat.rankUp}</b></div>
                <div className="rounded bg-green-50 border border-green-100 px-1.5 py-1 text-green-700">비용절감 <b>{stat.rankDown}</b></div>
                <div className="rounded bg-yellow-50 border border-yellow-100 px-1.5 py-1 text-yellow-700">노출없음↑ <b>{stat.noImp}</b></div>
              </div>
            );
          })()}

          <div className="flex-1 overflow-y-auto max-h-40">
            {logsLoading ? (
              <div className="text-center text-xs text-slate-400 py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />로딩 중...
              </div>
            ) : bidLogs.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-4">실행 기록 없음</div>
            ) : (
              <div className="space-y-0.5">
                {bidLogs.slice(0, 12).map(log => {
                  const d = new Date(log.createdAt);
                  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                  return (
                    <div key={log.id} className="flex items-center gap-2 text-xs py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-400 w-10 shrink-0 tabular-nums">{hm}</span>
                      <span className="text-slate-600 w-16 shrink-0 truncate">{log.strategy}</span>
                      <span className="font-medium text-[#093687] w-14 shrink-0 text-right tabular-nums">{log.totalChanged}변경</span>
                      <span className="text-slate-500 flex-1 text-right tabular-nums">{log.avgBid > 0 ? `${log.avgBid.toLocaleString()}원` : '-'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ====== AI 추천 패널 — 있을 때만 오버레이처럼 ====== */}
      {aiRecs.length > 0 && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6" onClick={() => setAiRecs([])}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />AI 추천 결과
              </h3>
              <button onClick={() => setAiRecs([])} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>
            <div className="space-y-3">
              {aiRecs.map(rec => (
                <div key={rec.groupName} className="border border-purple-200 rounded-lg p-3 bg-purple-50/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-purple-900 text-sm">{rec.groupName}</div>
                    <button onClick={() => { applyAiRec(rec); }} className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">적용</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div><span className="text-slate-500">목표순위</span> <span className="font-bold text-purple-900">{rec.targetRank}위</span></div>
                    <div><span className="text-slate-500">최대입찰</span> <span className="font-bold text-purple-900">{rec.maxBid.toLocaleString()}원</span></div>
                  </div>
                  {rec.reasons.map((r, i) => <p key={i} className="text-[11px] text-slate-600">• {r}</p>)}
                  {rec.effects.map((e, i) => <p key={`e${i}`} className="text-[11px] text-blue-600">→ {e}</p>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====== 시뮬레이션 결과 패널 — 있을 때만 오버레이 ====== */}
      {dryResult && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6" onClick={() => setDryResult(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b bg-blue-50 flex items-center justify-between sticky top-0">
              <div>
                <h3 className="font-bold text-blue-800">🔍 시뮬레이션 결과 (실제 적용 안 됨)</h3>
                <p className="text-xs text-blue-600">{dryResult.length}개 키워드 변경 예정</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleApplyDryRun} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">이대로 실행</button>
                <button onClick={() => setDryResult(null)} className="px-3 py-1.5 border border-blue-300 text-blue-600 rounded text-xs hover:bg-blue-100">닫기</button>
              </div>
            </div>
            {dryResult.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-[73px]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">키워드</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">그룹</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-500">현재</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-500">변경</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {dryResult.map((d, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{d.keyword}</td>
                      <td className="px-3 py-1.5 text-slate-500">{d.adGroup}</td>
                      <td className="px-3 py-1.5 text-right">{d.currentBid.toLocaleString()}원</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${d.newBid > d.currentBid ? 'text-red-600' : 'text-green-600'}`}>{d.newBid.toLocaleString()}원</td>
                      <td className="px-3 py-1.5 text-slate-500">{d.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">변경할 키워드가 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {/* 로그 상세 펼치기는 로그 클릭 시 별도 모달로 — 생략 (컴팩트 유지) */}
    </div>
  );
}
