import { useState, useEffect, useCallback, useRef } from 'react';
import { useNaverApi } from '@/hooks/useNaverApi';
import { supabase } from '@/lib/supabase';
import { toggleKeyword, updateKeywordBid, fetchBidEstimates, fetchAds, fetchBizMoney, getRelatedKeywords, fetchKeywords as apiFetchKeywords, type BidEstimate } from '@/lib/naverApi';
import { analyzeKeywordHealth, diagnoseKeyword, type DiagnosisResult } from '@/lib/aiAnalyzer';
import { Key, Search, ArrowUpDown, Loader2, TrendingUp, Star, Stethoscope, X, ExternalLink, AlertCircle } from 'lucide-react';
import { useAdStore } from '@/hooks/useAdStore';
import { toast } from 'sonner';
import QiImprovementModal from './QiImprovementModal';
import HelpTooltip from '@/components/common/HelpTooltip';
import { getCached, setCache } from '@/lib/cache';
import type { NaverKeyword } from '@/lib/types';

interface AdKeywordsProps {
  adAccountId: string | undefined;
}

type SortKey = 'keyword' | 'bidAmt' | 'status' | 'rank1' | 'qi';

// QI(품질지수) 배지 컴포넌트
function QiBadge({ grade }: { grade?: number }) {
  if (grade == null) return <span className="text-muted-foreground text-xs">-</span>;
  if (grade >= 7) return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">
      <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />최고
    </span>
  );
  if (grade >= 5) return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">좋음</span>;
  if (grade >= 3) return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">보통</span>;
  return <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">낮음</span>;
}

function Toggle({ on, loading, onClick }: { on: boolean; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      disabled={loading}
      className={`relative w-9 h-[18px] rounded-full transition-colors shrink-0 ${on ? 'bg-blue-500' : 'bg-gray-300'} ${loading ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin absolute top-[3px] left-1 text-white" />
      ) : (
        <span className={`block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      )}
    </button>
  );
}

function InlineBid({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 70) { toast.error('최소 입찰가는 70원입니다'); setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(num);
      toast.success('입찰가 변경됨');
    } catch {
      toast.error('입찰가 변경 실패');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={handleSave}
          autoFocus
          className="w-20 px-1.5 py-0.5 border rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
      </span>
    );
  }

  return (
    <button onClick={() => { setDraft(String(value)); setEditing(true); }} className="hover:underline hover:text-blue-600">
      {value?.toLocaleString()}원
    </button>
  );
}

function QuickBidButton({ label, bid, loading, onClick }: { label: string; bid: number; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || bid <= 0}
      className="px-1.5 py-0.5 text-[10px] rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-40 whitespace-nowrap"
      title={`${bid.toLocaleString()}원으로 변경`}
    >
      {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : label}
    </button>
  );
}

function BidCell({ bid, currentBid }: { bid: number; currentBid: number }) {
  if (bid <= 0) return <span className="text-muted-foreground">-</span>;
  const isBelow = currentBid < bid;
  return (
    <span className={`text-xs font-medium ${isBelow ? 'text-red-500' : 'text-green-600'}`}>
      {bid.toLocaleString()}
    </span>
  );
}

export default function AdKeywords({ adAccountId }: AdKeywordsProps) {
  const { campaigns, adGroups, keywords, fetchCampaigns, fetchAdGroups, fetchKeywords, refreshKeywords, loading, setKeywords } = useNaverApi(adAccountId);
  const store = useAdStore();
  const [selectedCampaign, setSelectedCampaignLocal] = useState(store.selectedKwCampaignId);
  const [selectedAdGroup, setSelectedAdGroupLocal] = useState(store.selectedAdgroupId);
  const [searchQuery, setSearchQueryLocal] = useState(store.keywordSearch);
  const setSelectedCampaign = (v: string) => { setSelectedCampaignLocal(v); store.setSelectedKwCampaignId(v); };
  const setSelectedAdGroup = (v: string) => { setSelectedAdGroupLocal(v); store.setSelectedAdgroupId(v); };
  const setSearchQuery = (v: string) => { setSearchQueryLocal(v); store.setKeywordSearch(v); };
  const [sortKey, setSortKey] = useState<SortKey>('keyword');
  const [sortAsc, setSortAsc] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [quickBidLoading, setQuickBidLoading] = useState<Set<string>>(new Set());
  const [showDormantOnly, setShowDormantOnly] = useState(false);
  const [diagnosing, setDiagnosing] = useState<string | null>(null);
  const [diagResult, setDiagResult] = useState<DiagnosisResult | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [qiModalKeyword, setQiModalKeyword] = useState<NaverKeyword | null>(null);

  // 경쟁 입찰가 데이터
  const [estimates, setEstimates] = useState<Record<string, BidEstimate[]>>({});
  const [estimateLoading, setEstimateLoading] = useState(false);
  const abortRef = useRef(false);

  // 검색량 데이터: keyword -> { pc, mobile, total, comp }
  const [volumes, setVolumes] = useState<Record<string, { pc: number; mobile: number; total: number; comp: string }>>({});

  // rank_logs 최신 순위 맵: keyword -> { rank, totalAds, createdAt }
  const [rankMap, setRankMap] = useState<Record<string, { rank: number; totalAds: number; createdAt: string }>>({});
  // keyword_quality 최신 품질 맵: ncc_keyword_id -> { adRel, expClk, qi }
  const [qualityMap, setQualityMap] = useState<Record<string, { adRel: number | null; expClk: number | null; qi: number | null }>>({});
  // ad_keyword_settings: ncc_keyword_id -> { autoBid, fixedBid }
  const [kwSettingsMap, setKwSettingsMap] = useState<Record<string, { autoBid: boolean; fixedBid: number | null }>>({});
  const [savedKeywords, setSavedKeywords] = useState<Set<string>>(new Set());
  const [errorKeywords, setErrorKeywords] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!adAccountId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('ad_keyword_settings')
        .select('ncc_keyword_id, auto_bid, fixed_bid')
        .eq('ad_account_id', adAccountId);
      if (cancelled) return;
      const map: Record<string, { autoBid: boolean; fixedBid: number | null }> = {};
      for (const row of (data || [])) {
        if (row.ncc_keyword_id) {
          map[row.ncc_keyword_id] = {
            autoBid: row.auto_bid ?? true,
            fixedBid: row.fixed_bid ?? null,
          };
        }
      }
      setKwSettingsMap(map);
    })();
    return () => { cancelled = true; };
  }, [adAccountId]);

  const saveKeywordSetting = async (kw: NaverKeyword, next: { autoBid: boolean; fixedBid: number | null }) => {
    if (!adAccountId) return;
    setKwSettingsMap(prev => ({ ...prev, [kw.nccKeywordId]: next }));
    try {
      const { error } = await supabase.from('ad_keyword_settings').upsert({
        ad_account_id: adAccountId,
        ncc_keyword_id: kw.nccKeywordId,
        ncc_adgroup_id: kw.nccAdgroupId,
        keyword: kw.keyword,
        auto_bid: next.autoBid,
        fixed_bid: next.fixedBid,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ad_account_id,ncc_keyword_id' });
      if (error) throw error;
      setSavedKeywords(prev => new Set(prev).add(kw.nccKeywordId));
      setTimeout(() => {
        setSavedKeywords(prev => { const n = new Set(prev); n.delete(kw.nccKeywordId); return n; });
      }, 3000);
    } catch {
      setErrorKeywords(prev => new Set(prev).add(kw.nccKeywordId));
      setTimeout(() => {
        setErrorKeywords(prev => { const n = new Set(prev); n.delete(kw.nccKeywordId); return n; });
      }, 3000);
    }
  };
  useEffect(() => {
    let cancelled = false;
    interface KwSnap {
      rankMap: Record<string, { rank: number; totalAds: number; createdAt: string }>;
      qualityMap: Record<string, { adRel: number | null; expClk: number | null; qi: number | null }>;
    }
    const KW_CACHE_KEY = 'keywords:rank_quality';
    const KW_CACHE_TTL = 3 * 60 * 1000;

    const cached = getCached<KwSnap>(KW_CACHE_KEY, KW_CACHE_TTL);
    if (cached) {
      setRankMap(cached.rankMap);
      setQualityMap(cached.qualityMap);
    }

    const load = async () => {
      try {
        const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
        const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const [rankRes, qualityRes] = await Promise.all([
          supabase.from('rank_logs')
            .select('keyword, rank, total_ads, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false }),
          supabase.from('keyword_quality')
            .select('ncc_keyword_id, ad_relevance_score, expected_click_score, qi_grade, created_at')
            .gte('created_at', since24)
            .order('created_at', { ascending: false })
            .limit(500),
        ]);
        if (cancelled) return;

        const rmap: Record<string, { rank: number; totalAds: number; createdAt: string }> = {};
        for (const row of (rankRes.data || [])) {
          if (!rmap[row.keyword]) {
            rmap[row.keyword] = { rank: row.rank, totalAds: row.total_ads, createdAt: row.created_at };
          }
        }
        setRankMap(rmap);

        const qmap: Record<string, { adRel: number | null; expClk: number | null; qi: number | null }> = {};
        for (const row of (qualityRes.data || [])) {
          const id = row.ncc_keyword_id;
          if (!id || qmap[id]) continue;
          qmap[id] = {
            adRel: row.ad_relevance_score,
            expClk: row.expected_click_score,
            qi: row.qi_grade,
          };
        }
        setQualityMap(qmap);
        setCache(KW_CACHE_KEY, { rankMap: rmap, qualityMap: qmap } as KwSnap);
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 3 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // 1. 마운트 시 캠페인 로드
  useEffect(() => {
    if (adAccountId) fetchCampaigns();
  }, [adAccountId, fetchCampaigns]);

  // 2. 캠페인 목록 로드 완료 → 저장된 선택 복원 또는 첫번째 → 광고그룹 로드
  useEffect(() => {
    if (campaigns.length === 0) return;
    const stored = store.selectedKwCampaignId;
    const exists = stored && campaigns.some(c => c.nccCampaignId === stored);
    const campId = exists ? stored : campaigns[0]?.nccCampaignId || '';
    if (!campId) return;
    // 항상 선택 상태 반영 + 광고그룹 로드
    setSelectedCampaignLocal(campId);
    store.setSelectedKwCampaignId(campId);
    fetchAdGroups(campId);
  }, [campaigns]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. 광고그룹 목록 로드 완료 → 저장된 선택 복원 또는 첫번째 → 키워드 로드
  useEffect(() => {
    if (adGroups.length === 0) return;
    const stored = store.selectedAdgroupId;
    const exists = stored && adGroups.some(g => g.nccAdgroupId === stored);
    const agId = exists ? stored : adGroups[0]?.nccAdgroupId || '';
    if (!agId) return;
    // 항상 선택 상태 반영 + 키워드 로드
    setSelectedAdGroupLocal(agId);
    store.setSelectedAdgroupId(agId);
    fetchKeywords(agId);
  }, [adGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  // 키워드 목록 변경 시 경쟁 입찰가 백그라운드 조회
  const fetchEstimates = useCallback(async () => {
    if (!adAccountId || keywords.length === 0) return;
    abortRef.current = false;
    setEstimateLoading(true);
    const newEstimates: Record<string, BidEstimate[]> = {};

    // 5개씩 병렬 조회
    for (let i = 0; i < keywords.length; i += 5) {
      if (abortRef.current) break;
      const batch = keywords.slice(i, i + 5);
      const promises = batch.map(async (kw) => {
        try {
          const est = await fetchBidEstimates(adAccountId, kw.nccKeywordId, kw.keyword);
          return { id: kw.nccKeywordId, est };
        } catch {
          return { id: kw.nccKeywordId, est: [] };
        }
      });
      const results = await Promise.all(promises);
      for (const { id, est } of results) {
        newEstimates[id] = est;
      }
      setEstimates(prev => ({ ...prev, ...newEstimates }));
    }
    setEstimateLoading(false);
  }, [adAccountId, keywords]);

  useEffect(() => {
    if (keywords.length > 0) {
      setEstimates({});
      fetchEstimates();
      // 검색량 조회 (5개씩 병렬, hintKeywords는 최대 5개)
      (async () => {
        if (!adAccountId) return;
        setVolumes({});
        const newVols: Record<string, { pc: number; mobile: number; total: number; comp: string }> = {};
        for (let i = 0; i < keywords.length; i += 5) {
          const batch = keywords.slice(i, i + 5).map(k => k.keyword);
          try {
            const related = await getRelatedKeywords(adAccountId, batch);
            for (const r of related) {
              if (batch.includes(r.relKeyword)) {
                const total = (r.monthlyPcQcCnt || 0) + (r.monthlyMobileQcCnt || 0);
                newVols[r.relKeyword] = { pc: r.monthlyPcQcCnt || 0, mobile: r.monthlyMobileQcCnt || 0, total, comp: r.compIdx || '-' };
              }
            }
            setVolumes({ ...newVols });
          } catch { /* skip */ }
        }
      })();
    }
    return () => { abortRef.current = true; };
  }, [keywords, fetchEstimates, adAccountId]);

  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaign(campaignId);
    setSelectedAdGroup('');
    abortRef.current = true;
    if (campaignId) fetchAdGroups(campaignId);
  };

  const handleAdGroupChange = async (adGroupId: string) => {
    setSelectedAdGroup(adGroupId);
    abortRef.current = true;
    if (!adAccountId) return;
    if (adGroupId === 'all') {
      const allKws = await Promise.all(
        adGroups.map(g =>
          apiFetchKeywords(adAccountId, g.nccAdgroupId)
            .then(kws => kws.map(kw => ({ ...kw, _groupName: g.name })))
            .catch(() => [] as NaverKeyword[])
        )
      );
      setKeywords(allKws.flat() as NaverKeyword[]);
    } else if (adGroupId) {
      fetchKeywords(adGroupId);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleToggleKeyword = async (keywordId: string, currentOn: boolean) => {
    if (!adAccountId) return;
    setTogglingIds(prev => new Set(prev).add(keywordId));
    try {
      const result = await toggleKeyword(adAccountId, keywordId, currentOn);
      if (result.error) toast.error(`변경 실패: ${result.error}`);
      else {
        toast.success(`키워드 ${currentOn ? 'OFF' : 'ON'} 변경됨`);
        if (selectedAdGroup) refreshKeywords(selectedAdGroup);
      }
    } catch { toast.error('변경 실패'); }
    finally { setTogglingIds(prev => { const s = new Set(prev); s.delete(keywordId); return s; }); }
  };

  const handleBidSave = async (keywordId: string, bidAmt: number) => {
    if (!adAccountId) return;
    // 낙관적 업데이트: UI 즉시 반영
    const oldBid = keywords.find(k => k.nccKeywordId === keywordId)?.bidAmt ?? 0;
    setKeywords(prev => prev.map(k => k.nccKeywordId === keywordId ? { ...k, bidAmt } : k));
    try {
      const ok = await updateKeywordBid(adAccountId, keywordId, bidAmt, selectedAdGroup || undefined);
      if (!ok) throw new Error('API 오류');
      // 성공 — 백그라운드 검증용 refetch
      if (selectedAdGroup) refreshKeywords(selectedAdGroup);
    } catch (e) {
      // 실패 — 롤백
      setKeywords(prev => prev.map(k => k.nccKeywordId === keywordId ? { ...k, bidAmt: oldBid } : k));
      toast.error('입찰가 저장 실패 — 이전 값으로 복원');
      throw e;
    }
  };

  const handleQuickBid = async (keywordId: string, targetBid: number) => {
    if (!adAccountId || targetBid <= 0) return;
    // 낙관적 업데이트
    const oldBid = keywords.find(k => k.nccKeywordId === keywordId)?.bidAmt ?? 0;
    setKeywords(prev => prev.map(k => k.nccKeywordId === keywordId ? { ...k, bidAmt: targetBid } : k));
    setQuickBidLoading(prev => new Set(prev).add(keywordId));
    try {
      const ok = await updateKeywordBid(adAccountId, keywordId, targetBid, selectedAdGroup || undefined);
      if (!ok) throw new Error('updateKeywordBid returned false');
      if (ok && selectedAdGroup) {
        // 검증: 재조회하여 실제 변경 확인
        const { fetchKeywords: refetch } = await import('@/lib/naverApi');
        const fresh = await refetch(adAccountId, selectedAdGroup);
        const target = fresh.find(k => k.nccKeywordId === keywordId);
        if (target && target.bidAmt === targetBid) {
          toast.success(`✅ 입찰가 ${targetBid.toLocaleString()}원 변경 확인`);
        } else {
          // 서버에 반영되지 않음 — 롤백
          setKeywords(prev => prev.map(k => k.nccKeywordId === keywordId ? { ...k, bidAmt: oldBid } : k));
          toast.error(`⚠️ 변경 확인 실패 — 이전 값으로 복원`);
        }
        refreshKeywords(selectedAdGroup);
      } else if (!ok) {
        setKeywords(prev => prev.map(k => k.nccKeywordId === keywordId ? { ...k, bidAmt: oldBid } : k));
        toast.error('입찰가 변경 실패 — 이전 값으로 복원');
      }
    } catch {
      setKeywords(prev => prev.map(k => k.nccKeywordId === keywordId ? { ...k, bidAmt: oldBid } : k));
      toast.error('입찰가 변경 실패 — 이전 값으로 복원');
    }
    finally { setQuickBidLoading(prev => { const s = new Set(prev); s.delete(keywordId); return s; }); }
  };

  // 노출 진단
  const handleDiagnose = async (kw: { nccKeywordId: string; keyword: string; bidAmt: number; status?: string; userLock?: boolean; nccQi?: { qiGrade: number }; nccAdgroupId: string }) => {
    if (!adAccountId) return;
    setDiagnosing(kw.nccKeywordId);
    setDiagResult(null);
    setDiagError(null);
    try {
      const [bm, adsData] = await Promise.all([
        fetchBizMoney(adAccountId),
        fetchAds(adAccountId, kw.nccAdgroupId),
      ]);
      const adInspect = adsData.length > 0 ? (adsData[0] as { inspectStatus?: string }).inspectStatus : undefined;
      const rank1 = getRankBid(kw.nccKeywordId, 1);
      const rank3 = getRankBid(kw.nccKeywordId, 3);
      const result = diagnoseKeyword({
        keyword: kw.keyword,
        bidAmt: kw.bidAmt,
        status: kw.status || 'ELIGIBLE',
        qiGrade: kw.nccQi?.qiGrade || 4,
        campaignOn: true, // 이미 조회된 캠페인이므로
        adGroupOn: true,
        keywordOn: !kw.userLock && kw.status === 'ELIGIBLE',
        adInspectStatus: adInspect,
        bizMoney: bm,
        todayCost: 0,
        dailyBudget: 300000,
        rank1Bid: rank1,
        rank3Bid: rank3,
      });
      setDiagResult(result);
    } catch (e) {
      const errMsg = (e as Error).message;
      toast.error(`진단 실패: ${errMsg}`);
      setDiagError(errMsg);
    }
    finally { setDiagnosing(null); }
  };

  // 순위별 입찰가 추출 (server.js와 동일: impressions 비율 기반)
  const getRankBid = (keywordId: string, rank: number): number => {
    const est = estimates[keywordId];
    if (!est || est.length === 0) return 0;
    const thresholds: Record<number, number> = { 1: 0.95, 2: 0.80, 3: 0.65, 5: 0.40, 7: 0.20, 10: 0.01 };
    const threshold = thresholds[rank] ?? 0.5;
    const maxImp = Math.max(...est.map(e => e.impressions || 0), 1);
    for (const e of est) {
      const ratio = (e.impressions || 0) / maxImp;
      if (ratio >= threshold) return e.bid;
    }
    return 0;
  };

  const filteredKeywords = keywords
    .filter(k => k.keyword.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(k => !showDormantOnly || k.status === 'PAUSED')
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === 'bidAmt') return (a.bidAmt - b.bidAmt) * dir;
      if (sortKey === 'status') return (a.status || '').localeCompare(b.status || '') * dir;
      if (sortKey === 'rank1') return (getRankBid(a.nccKeywordId, 1) - getRankBid(b.nccKeywordId, 1)) * dir;
      if (sortKey === 'qi') return ((a.nccQi?.qiGrade ?? 0) - (b.nccQi?.qiGrade ?? 0)) * dir;
      return a.keyword.localeCompare(b.keyword) * dir;
    });

  if (!adAccountId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Key className="w-5 h-5" />키워드 관리
          <HelpTooltip
            title="키워드"
            auto="3분마다 경쟁사 입찰가 수집. 자동입찰 ON 키워드는 자동 조정."
            manual="자동입찰 ON/OFF 설정. 중요 키워드는 고정입찰가 직접 입력. 품질지수 낮으면 소재 개선."
          />
        </h2>
        <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-muted-foreground">
          광고 계정을 먼저 설정해주세요.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Key className="w-5 h-5" />키워드 관리
          <HelpTooltip
            title="키워드"
            auto="3분마다 경쟁사 입찰가 수집. 자동입찰 ON 키워드는 자동 조정."
            manual="자동입찰 ON/OFF 설정. 중요 키워드는 고정입찰가 직접 입력. 품질지수 낮으면 소재 개선."
          />
        </h2>
        {estimateLoading && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />경쟁 입찰가 조회 중...
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedCampaign}
          onChange={e => handleCampaignChange(e.target.value)}
          className="px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">캠페인 선택</option>
          {campaigns.map(c => (
            <option key={c.nccCampaignId} value={c.nccCampaignId}>{c.name}</option>
          ))}
        </select>

        <select
          value={selectedAdGroup}
          onChange={e => handleAdGroupChange(e.target.value)}
          disabled={!selectedCampaign}
          className="px-3 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
        >
          <option value="">광고그룹 선택</option>
          <option value="all">전체 그룹</option>
          {adGroups.map(g => (
            <option key={g.nccAdgroupId} value={g.nccAdgroupId}>{g.name}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="키워드 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <button
          onClick={() => setShowDormantOnly(!showDormantOnly)}
          className={`px-3 py-2 rounded-lg text-sm border transition-colors whitespace-nowrap ${
            showDormantOnly ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-white text-muted-foreground hover:bg-muted/50'
          }`}
        >
          {showDormantOnly ? '휴면만' : '휴면키워드만'}
        </button>
      </div>

      {/* Keywords Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">키워드 목록</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredKeywords.length}개 키워드</p>
          </div>
          {Object.keys(estimates).length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3" />
              경쟁 입찰가 {Object.keys(estimates).length}/{keywords.length}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-12 px-3 py-2 text-center font-medium text-muted-foreground">ON</th>
                {selectedAdGroup === 'all' && (
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">그룹</th>
                )}
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  <button onClick={() => handleSort('keyword')} className="flex items-center gap-1 hover:text-foreground">
                    키워드 <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                  <button onClick={() => handleSort('bidAmt')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    현재입찰 <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                  <button onClick={() => handleSort('rank1')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    1위 <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">2위</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">3위</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">월검색</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground text-[11px]" title="광고 연관지수 / 10 (keyword_quality)">광고연관</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground text-[11px]" title="클릭 기대지수 / 10 (keyword_quality)">클릭기대</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground" title="rank-tracker 실시간 수집값">실시간 순위</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">빠른 입찰</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">상태</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                  <button onClick={() => handleSort('qi')} className="flex items-center gap-1 mx-auto hover:text-foreground" title="품질지수 (QI)">
                    품질지수 <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-center px-2 py-2 font-medium text-muted-foreground text-xs">자동입찰</th>
                <th className="text-center px-2 py-2 font-medium text-muted-foreground text-xs">고정입찰가</th>
                <th className="text-center px-2 py-2 font-medium text-muted-foreground text-xs">진단</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={selectedAdGroup === 'all' ? 17 : 16} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />키워드 조회 중...
                </td></tr>
              ) : filteredKeywords.length === 0 ? (
                <tr><td colSpan={selectedAdGroup === 'all' ? 17 : 16} className="px-4 py-10 text-center text-muted-foreground">
                  {selectedAdGroup ? (
                    <div><p className="font-medium mb-1">키워드가 없어요</p><p className="text-xs">이 광고그룹에 키워드를 추가하세요</p></div>
                  ) : (
                    <div><p className="font-medium mb-1">캠페인과 광고그룹을 선택하세요</p><p className="text-xs">좌측 드롭다운에서 선택하면 키워드가 표시됩니다</p></div>
                  )}
                </td></tr>
              ) : (
                filteredKeywords.map(kw => {
                  const isOn = kw.status === 'ELIGIBLE';
                  const rank1 = getRankBid(kw.nccKeywordId, 1);
                  const rank2 = getRankBid(kw.nccKeywordId, 2);
                  const rank3 = getRankBid(kw.nccKeywordId, 3);
                  const rank5 = getRankBid(kw.nccKeywordId, 5);
                  const hasEstimate = !!estimates[kw.nccKeywordId];
                  const isQuickLoading = quickBidLoading.has(kw.nccKeywordId);

                  // AI 키워드 건강도
                  const health = analyzeKeywordHealth(kw.keyword, kw.bidAmt, rank1, rank3, kw.status || 'ELIGIBLE');
                  const hint = hasEstimate ? `${health.icon} ${health.message}` : '';
                  const hintColor = health.color;

                  return (
                    <tr key={kw.nccKeywordId} className={`border-t hover:bg-muted/30 ${hasEstimate && rank3 > 0 && kw.bidAmt < rank3 ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <Toggle on={isOn} loading={togglingIds.has(kw.nccKeywordId)} onClick={() => handleToggleKeyword(kw.nccKeywordId, isOn)} />
                      </td>
                      {selectedAdGroup === 'all' && (
                        <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[100px]">
                          {(kw as NaverKeyword & { _groupName?: string })._groupName || '-'}
                        </td>
                      )}
                      <td className="px-3 py-2 max-w-[200px]">
                        <p className="font-medium truncate">{kw.keyword}</p>
                        {hint && <p className={`text-[10px] ${hintColor} mt-0.5`}>{hint}</p>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <InlineBid value={kw.bidAmt} onSave={v => handleBidSave(kw.nccKeywordId, v)} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {hasEstimate ? <BidCell bid={rank1} currentBid={kw.bidAmt} /> : (
                          estimateLoading ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" /> : <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {hasEstimate ? <BidCell bid={rank2} currentBid={kw.bidAmt} /> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {hasEstimate ? <BidCell bid={rank3} currentBid={kw.bidAmt} /> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {(() => {
                          const v = volumes[kw.keyword];
                          if (!v) return <span className="text-muted-foreground text-xs">-</span>;
                          const colorClass = v.total >= 5000 ? 'text-red-600' : v.total >= 1000 ? 'text-yellow-600' : 'text-green-600';
                          return (
                            <div className="text-right">
                              <p className={`text-xs font-bold ${colorClass}`}>{v.total.toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">/일 {Math.round(v.total / 30)}</p>
                            </div>
                          );
                        })()}
                      </td>
                      {/* 광고 연관지수 */}
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const q = qualityMap[kw.nccKeywordId];
                          const v = q?.adRel;
                          if (v == null) return <span className="text-muted-foreground text-xs">-</span>;
                          const color = v >= 7 ? 'text-green-600' : v >= 4 ? 'text-yellow-600' : 'text-red-600';
                          return <span className={`text-xs font-bold ${color}`}>{v}/10</span>;
                        })()}
                      </td>
                      {/* 클릭 기대지수 */}
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const q = qualityMap[kw.nccKeywordId];
                          const v = q?.expClk;
                          if (v == null) return <span className="text-muted-foreground text-xs">-</span>;
                          const color = v >= 7 ? 'text-green-600' : v >= 4 ? 'text-yellow-600' : 'text-red-600';
                          return <span className={`text-xs font-bold ${color}`}>{v}/10</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const snap = rankMap[kw.keyword];
                          if (!snap) return <span className="text-muted-foreground text-xs">-</span>;
                          const rank = snap.rank;
                          const color = rank === 0 ? 'text-red-600' : rank <= 3 ? 'text-green-600' : rank <= 5 ? 'text-blue-600' : 'text-amber-600';
                          const label = rank === 0 ? '미노출' : `${rank}위`;
                          return (
                            <div className="flex flex-col items-center">
                              <span className={`text-sm font-bold ${color}`}>{label}</span>
                              <span className="text-[9px] text-muted-foreground">광고 {snap.totalAds}개</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {hasEstimate ? (
                          <div className="flex gap-1 justify-center">
                            <QuickBidButton label="1위" bid={rank1} loading={isQuickLoading} onClick={() => handleQuickBid(kw.nccKeywordId, rank1)} />
                            <QuickBidButton label="3위" bid={rank3} loading={isQuickLoading} onClick={() => handleQuickBid(kw.nccKeywordId, rank3)} />
                            <QuickBidButton label="5위" bid={rank5} loading={isQuickLoading} onClick={() => handleQuickBid(kw.nccKeywordId, rank5)} />
                          </div>
                        ) : <span className="text-muted-foreground text-xs">-</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${isOn ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {isOn ? '활성' : kw.status || '정지'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <QiBadge grade={kw.nccQi?.qiGrade} />
                          {kw.nccQi?.qiGrade != null && kw.nccQi.qiGrade < 7 && (
                            <button onClick={() => setQiModalKeyword(kw)}
                              className="text-[10px] text-blue-500 hover:text-blue-700" title="품질지수 (QI) 개선 방법">💡</button>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {(() => {
                          const s = kwSettingsMap[kw.nccKeywordId];
                          const autoBid = s?.autoBid ?? true;
                          return (
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={autoBid}
                                onChange={e => saveKeywordSetting(kw, {
                                  autoBid: e.target.checked,
                                  fixedBid: s?.fixedBid ?? null,
                                })}
                              />
                              <span className="text-[10px]">{autoBid ? '자동' : '고정'}</span>
                            </label>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {(() => {
                          const s = kwSettingsMap[kw.nccKeywordId];
                          const autoBid = s?.autoBid ?? true;
                          const saved = savedKeywords.has(kw.nccKeywordId);
                          const errored = errorKeywords.has(kw.nccKeywordId);
                          if (autoBid) {
                            return (
                              <>
                                <span className="text-muted-foreground text-xs">-</span>
                                {saved && <span className="text-green-600 text-xs ml-1">✅ 저장됨</span>}
                                {errored && <span className="text-red-500 text-xs ml-1">❌ 저장실패</span>}
                              </>
                            );
                          }
                          return (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                defaultValue={s?.fixedBid ?? ''}
                                placeholder="원"
                                className="w-20 border rounded px-1 text-xs text-right"
                                onBlur={e => {
                                  const v = Number(e.target.value);
                                  const next = v > 0 ? v : null;
                                  if ((s?.fixedBid ?? null) !== next) {
                                    saveKeywordSetting(kw, { autoBid: false, fixedBid: next });
                                  }
                                }}
                              />
                              {saved && <span className="text-green-600 text-xs">✅</span>}
                              {errored && <span className="text-red-500 text-xs">❌</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => handleDiagnose(kw)} disabled={diagnosing === kw.nccKeywordId}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium disabled:opacity-50">
                          {diagnosing === kw.nccKeywordId ? <Loader2 className="w-3 h-3 animate-spin" /> : <>🩺 진단</>}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 노출 진단 에러 모달 */}
      {diagError && !diagResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDiagError(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center" onClick={e => e.stopPropagation()}>
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h3 className="font-bold text-foreground mb-2">진단 실패</h3>
            <p className="text-sm text-muted-foreground mb-4">{diagError}</p>
            <button onClick={() => setDiagError(null)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">닫기</button>
          </div>
        </div>
      )}

      {/* 노출 진단 모달 */}
      {diagResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDiagResult(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-foreground">{diagResult.keyword} 노출 진단</h3>
                  <p className="text-[10px] text-muted-foreground">순위점수: {diagResult.rankScore.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => setDiagResult(null)} className="p-1.5 rounded-lg hover:bg-muted/50"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-auto max-h-[55vh] px-5 py-4 space-y-2">
              {diagResult.items.map((item, i) => (
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                  item.severity === 'error' ? 'bg-red-50' : item.severity === 'warn' ? 'bg-yellow-50' : item.severity === 'ok' ? 'bg-green-50/50' : 'bg-gray-50'
                }`}>
                  <span className="text-base shrink-0">{item.icon}</span>
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    {item.detail && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">{item.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t bg-muted/20 space-y-3">
              {/* 검색량 정보 */}
              {(() => {
                const v = volumes[diagResult.keyword];
                if (!v) return null;
                const dailyAvg = Math.round(v.total / 30);
                const lowVol = v.total < 100;
                return (
                  <div className={`rounded-lg p-3 ${lowVol ? 'bg-yellow-50' : 'bg-green-50'}`}>
                    <p className="text-xs font-bold text-foreground mb-1">📊 월간 검색량</p>
                    <p className="text-xs text-slate-700">PC: {v.pc.toLocaleString()}회 | 모바일: {v.mobile.toLocaleString()}회 | <strong>합계: {v.total.toLocaleString()}회</strong></p>
                    <p className="text-xs text-slate-700">일평균: 약 {dailyAvg.toLocaleString()}회 검색</p>
                    {lowVol ? (
                      <p className="text-[11px] text-yellow-700 mt-1">⚠️ 검색량이 적습니다. 광고가 노출되더라도 클릭이 적을 수 있어요.</p>
                    ) : v.total > 1000 ? (
                      <p className="text-[11px] text-green-700 mt-1">✅ 검색량 충분 — 광고 노출 기회 많음</p>
                    ) : null}
                  </div>
                );
              })()}
              <div>
                <p className="text-xs font-bold text-foreground mb-1">📊 추정 원인</p>
                <p className="text-sm text-foreground">{diagResult.cause}</p>
              </div>
              {diagResult.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-1">💡 권장 조치</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {diagResult.recommendations.map((r, i) => <li key={i}>{i + 1}. {r}</li>)}
                  </ul>
                </div>
              )}
              <a href={`https://search.naver.com/search.naver?query=${encodeURIComponent(diagResult.keyword)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                네이버에서 직접 확인하기 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* QI 개선 방법 모달 */}
      {qiModalKeyword && adAccountId && (
        <QiImprovementModal
          keyword={qiModalKeyword.keyword}
          currentGrade={qiModalKeyword.nccQi?.qiGrade || 0}
          adAccountId={adAccountId}
          adGroupId={qiModalKeyword.nccAdgroupId}
          onClose={() => setQiModalKeyword(null)}
        />
      )}

      {/* 노출 제한 키워드 섹션 */}
      {adAccountId && selectedAdGroup && (
        <RestrictedKeywordsSection adAccountId={adAccountId} adGroupId={selectedAdGroup} />
      )}
    </div>
  );
}

// ===== 노출 제한 키워드 섹션 =====
function RestrictedKeywordsSection({ adAccountId, adGroupId }: { adAccountId: string; adGroupId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ keyword: string; type: number }[]>([]);
  const [newKw, setNewKw] = useState('');
  const [matchTp, setMatchTp] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { fetchRestrictedKeywords } = await import('@/lib/naverApi');
      const data = await fetchRestrictedKeywords(adAccountId, adGroupId);
      setItems(data.map(d => ({ keyword: d.keyword, type: d.type })));
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open, adGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async (kw?: string) => {
    const keyword = (kw || newKw).trim();
    if (!keyword) return;
    try {
      const { addRestrictedKeywords } = await import('@/lib/naverApi');
      const r = await addRestrictedKeywords(adAccountId, adGroupId, [{ keyword, type: matchTp }]);
      if (r.error) toast.error(`추가 실패: ${r.error}`);
      else { toast.success(`'${keyword}' 추가됨`); setNewKw(''); load(); }
    } catch (e) { toast.error(`추가 실패: ${(e as Error).message}`); }
  };

  const handleDelete = async (keyword: string) => {
    try {
      const { deleteRestrictedKeyword } = await import('@/lib/naverApi');
      const r = await deleteRestrictedKeyword(adAccountId, adGroupId, keyword);
      if (r.error) toast.error(`삭제 실패: ${r.error}`);
      else { toast.success(`'${keyword}' 삭제됨`); load(); }
    } catch (e) { toast.error(`삭제 실패: ${(e as Error).message}`); }
  };

  return (
    <div className="mt-4 bg-white rounded-xl border shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full p-4 text-left text-sm font-semibold flex items-center justify-between hover:bg-slate-50 rounded-xl">
        <span className="flex items-center gap-2">🚫 노출 제한 키워드 {items.length > 0 && <span className="text-xs text-slate-500">({items.length}개)</span>}</span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-4 border-t border-slate-100">
          {loading ? (
            <p className="text-xs text-slate-500 py-2"><Loader2 className="w-3 h-3 animate-spin inline mr-1" />로딩 중...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-400 mb-3">등록된 노출 제한 키워드가 없습니다.</p>
          ) : (
            <div className="space-y-1 mb-3">
              {items.map((rk, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 border-b border-slate-100 hover:bg-slate-50">
                  <span className="text-sm">{rk.keyword}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">{rk.type === 1 ? '완전일치' : '구문일치'}</span>
                    <button onClick={() => handleDelete(rk.keyword)} className="text-red-500 text-xs hover:text-red-700">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={newKw} onChange={e => setNewKw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="제한할 키워드 입력"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <select value={matchTp} onChange={e => setMatchTp(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
              <option value={1}>완전일치</option>
              <option value={2}>구문일치</option>
            </select>
            <button onClick={() => handleAdd()}
              className="px-3 py-1.5 bg-[#093687] text-white rounded-lg text-sm hover:bg-[#072b6e]">
              추가
            </button>
          </div>
          <div className="mt-3 bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-700 mb-2">🤖 제외 권장 키워드 (분양과 무관):</p>
            <div className="flex flex-wrap gap-1.5">
              {['월세', '전세', '빌라', '오피스텔', '임대', '매매'].map(kw => (
                <button key={kw} onClick={() => handleAdd(kw)}
                  className="bg-white border border-blue-200 rounded px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100">
                  + {kw}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
