import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Zap,
  Eye,
  Lock,
  Pencil,
  Trash2,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Monitor,
  Smartphone,
  Search,
  Settings2,
  Download,
} from 'lucide-react';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';
import { workerFetch } from '@/lib/api';
import { useSite } from '@/contexts/SiteContext';
import { usePlan } from '@/hooks/usePlan';

type Device = 'ALL' | 'PC' | 'M';
type StatusFilter = 'all' | 'normal' | 'no_impression' | 'paused' | 'max_reached';

interface CampaignGroup {
  campaign_id: string;
  campaign_name: string;
  groups?: { group_id: string; group_name: string }[];
}

interface GroupStrategy {
  id?: number;
  site_id?: string;
  campaign_id: string;
  group_id: string;
  target_rank: number;
  max_bid: number;
  min_bid: number;
  device: Device;
  lowest_bid: number;
  hourly_preset?: 'peak' | 'night' | 'all3' | null;
}

type Tab = 'keywords' | 'logs';

interface HourSchedule {
  [hour: string]: number | 'stop' | null;
}

interface KeywordStat {
  keyword: string;
  keyword_id?: string;
  ncc_keyword_id?: string;
  ncc_adgroup_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  group_id?: string;
  group_name?: string;
  current_rank: number | null;
  current_bid: number;
  target_rank: number | null;
  max_bid?: number;
  min_bid?: number;
  bid_setting_id?: number | null;
  is_active?: number;
  strategy?: string;
  device?: Device;
  lowest_bid?: number;
  lowest_bid_wait_min?: number;
  ad_status?: string;
  user_locked?: number;
  hourly_schedule?: HourSchedule | string;
  qi_grade?: number | null;
  monthly_pc?: number | null;
  monthly_mobile?: number | null;
  bid_rank1?: number | null;
  bid_rank3?: number | null;
  bid_rank5?: number | null;
}

interface BidLog {
  id: number;
  created_at: string;
  keyword: string;
  prev_bid: number;
  new_bid: number;
  current_rank: number | null;
  target_rank: number | null;
  strategy: string;
  reason?: string;
}

interface OptimizerResultItem {
  keyword: string;
  current_bid: number;
  new_bid: number;
  current_rank: number | null;
  target_rank: number | null;
  action: 'raise' | 'lower' | 'skip' | 'keep';
  reason?: string;
}

interface OptimizerResponse {
  results?: OptimizerResultItem[];
  changed?: number;
  kept?: number;
  skipped?: number;
}

const won = (n: number) => `₩${(n ?? 0).toLocaleString()}`;

type StatusKind =
  | 'normal'
  | 'achieved'
  | 'bidding'
  | 'lowering'
  | 'no_impression'
  | 'max_reached'
  | 'paused'
  | 'user_locked'
  | 'unset';

function getStatus(kw: KeywordStat): { kind: StatusKind; label: string; cls: string; tooltip?: string } {
  if (kw.user_locked) {
    return { kind: 'user_locked', label: '사용자잠금', cls: 'bg-gray-100 text-gray-500 border-gray-300' };
  }
  if (kw.ad_status && /paused|stopped|중지|off/i.test(kw.ad_status)) {
    return {
      kind: 'paused',
      label: '광고중지',
      cls: 'bg-red-50 text-red-700 border-red-200',
      tooltip: kw.ad_status,
    };
  }
  if (kw.max_bid && kw.current_bid >= kw.max_bid)
    return { kind: 'max_reached', label: '최대도달', cls: 'bg-red-50 text-red-600 border-red-200' };
  if (kw.current_rank == null)
    return { kind: 'no_impression', label: '노출없음', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (kw.target_rank == null)
    return { kind: 'unset', label: '미설정', cls: 'bg-gray-50 text-gray-500 border-gray-200' };
  if (kw.current_rank === kw.target_rank)
    return { kind: 'achieved', label: '목표달성', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (kw.current_rank < kw.target_rank)
    return { kind: 'lowering', label: '하향입찰', cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  return { kind: 'bidding', label: '입찰중', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
}

function statusToFilterKind(kind: StatusKind): StatusFilter {
  if (kind === 'no_impression') return 'no_impression';
  if (kind === 'paused') return 'paused';
  if (kind === 'max_reached') return 'max_reached';
  return 'normal';
}

export function AutoBidPage() {
  const { siteId } = useSite();
  const { isFree, isLoading: planLoading } = usePlan();
  const [tab, setTab] = useState<Tab>('keywords');
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Keyword tab state
  const [keywords, setKeywords] = useState<KeywordStat[]>([]);
  const [loadingKw, setLoadingKw] = useState(false);
  const [running, setRunning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<OptimizerResponse | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<KeywordStat | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Filter + selection state
  const [campaignsGroups, setCampaignsGroups] = useState<CampaignGroup[]>([]);
  const [groupStrategies, setGroupStrategies] = useState<GroupStrategy[]>([]);
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<string>('');
  const [editingGroupKey, setEditingGroupKey] = useState<{ campaign_id: string; group_id: string; group_name: string } | null>(null);
  const [showAllGroupsBulk, setShowAllGroupsBulk] = useState(false);
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterDevice, setFilterDevice] = useState<Device | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number | null } | null>(null);
  const estimateRefetchedRef = useRef(false);

  // Sort state
  const [sortKey, setSortKey] = useState<string>('current_bid');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Logs tab state
  const [logs, setLogs] = useState<BidLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const normalizeKeyword = (k: any): KeywordStat => ({
    ...k,
    keyword: k.keyword || k.keyword_name || '',
    keyword_id: k.ncc_keyword_id || k.keyword_id || k.nccKeywordId || k.id,
    ncc_keyword_id: k.ncc_keyword_id || k.nccKeywordId || k.keyword_id,
    ncc_adgroup_id: k.ncc_adgroup_id || k.nccAdgroupId || k.adgroupId || k.adgroup_id || k.group_id || '',
    campaign_id: k.ncc_campaign_id || k.campaign_id || k.nccCampaignId || k.campaignId || '',
    campaign_name: k.campaign_name || k.campaignName || '',
    // 핵심: keyword-stats 응답 필드는 ncc_adgroup_id (snake_case)
    group_id: k.ncc_adgroup_id || k.group_id || k.groupId || k.nccAdgroupId || k.adgroupId || k.adgroup_id || '',
    group_name: k.group_name || k.groupName || k.adgroupName || k.nccAdgroupName || '',
  });

  const loadKeywords = async () => {
    if (!siteId) return;
    setLoadingKw(true);
    setLoadProgress({ loaded: 0, total: null });
    const PAGE = 50;
    const all: KeywordStat[] = [];
    let offset = 0;
    try {
      while (true) {
        const data = await workerFetch<
          { data?: KeywordStat[]; keywords?: KeywordStat[]; total?: number } | KeywordStat[]
        >(`/naver/keyword-stats?site_id=${siteId}&offset=${offset}&limit=${PAGE}`);
        const rawItems: any[] = Array.isArray(data)
          ? data
          : data?.data ?? data?.keywords ?? [];
        const items = rawItems.map(normalizeKeyword);
        const total = !Array.isArray(data) && typeof data?.total === 'number' ? data.total : null;
        all.push(...items);
        setKeywords([...all]);
        setLoadProgress({ loaded: all.length, total });
        if (items.length < PAGE) break;
        offset += PAGE;
        if (offset > 5000) break; // safety cap
      }
    } catch (e) {
      console.error('keyword-stats load failed', e);
    } finally {
      setLoadingKw(false);
      setLoadProgress(null);
    }
  };

  const loadLogs = async () => {
    if (!siteId) return;
    setLoadingLogs(true);
    try {
      const data = await workerFetch<{ logs?: BidLog[] } | BidLog[]>(
        `/naver/bid-logs?site_id=${siteId}&limit=50`,
      );
      const list = Array.isArray(data) ? data : data?.logs ?? [];
      setLogs(list);
    } catch (e) {
      console.error('bid-logs load failed', e);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const loadCampaignsGroups = async () => {
    if (!siteId) return;
    try {
      const data = await workerFetch<any>(`/naver/campaigns-groups?site_id=${siteId}`);
      const raw: any[] = Array.isArray(data)
        ? data
        : data?.data ?? data?.campaigns ?? [];
      // 네이버 API 원본(camelCase)과 D1 형태(snake_case) 모두 정규화
      const list: CampaignGroup[] = raw.map((c: any) => ({
        campaign_id:
          c.campaign_id ?? c.nccCampaignId ?? c.campaignId ?? c.id ?? '',
        campaign_name:
          c.campaign_name ?? c.campaignName ?? c.name ?? '(이름없음)',
        groups: (c.groups ?? c.adgroups ?? c.adGroups ?? []).map((g: any) => ({
          group_id:
            g.group_id ?? g.groupId ?? g.nccAdgroupId ?? g.adgroupId ?? g.id ?? '',
          group_name:
            g.group_name ?? g.groupName ?? g.adgroupName ?? g.nccAdgroupName ?? g.name ?? '(이름없음)',
        })),
      }));
      setCampaignsGroups(list);
      if (list.length > 0 && !activeCampaign) setActiveCampaign(list[0].campaign_id);
    } catch {
      setCampaignsGroups([]);
    }
  };

  const loadGroupStrategies = async () => {
    if (!siteId) return;
    try {
      const data = await workerFetch<{ data?: GroupStrategy[]; strategies?: GroupStrategy[] } | GroupStrategy[]>(
        `/naver/group-strategy?site_id=${siteId}`,
      );
      const list: GroupStrategy[] = Array.isArray(data)
        ? data
        : data?.data ?? data?.strategies ?? [];
      setGroupStrategies(list);
    } catch {
      setGroupStrategies([]);
    }
  };

  useEffect(() => {
    if (!siteId) return;
    if (tab === 'keywords') {
      estimateRefetchedRef.current = false;
      loadKeywords();
      loadCampaignsGroups();
      loadGroupStrategies();
    }
    if (tab === 'logs') loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, siteId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const runOptimizer = async (dryRun: boolean) => {
    // Free 플랜은 미리보기(dryRun)만 허용
    if (isFree && !dryRun) {
      setShowUpgrade(true);
      return;
    }
    const setLoading = dryRun ? setPreviewing : setRunning;
    setLoading(true);
    try {
      const res = await workerFetch<OptimizerResponse>('/naver/run-optimizer', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          strategy: 'target_rank',
          settings: { targetRank: 3, maxBid: 3000, dryRun, maxKeywords: 50 },
        }),
      });
      if (dryRun) {
        setPreviewResult(res);
      } else {
        const n = res.changed ?? res.results?.filter((r) => r.action !== 'skip' && r.action !== 'keep').length ?? 0;
        showToast(`${n}개 키워드 입찰가 조정 완료`);
        await loadKeywords();
      }
    } catch (e: any) {
      showToast(`실패: ${e?.message ?? '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const applyPreview = async () => {
    setPreviewResult(null);
    await runOptimizer(false);
  };

  const toggleActive = async (kw: KeywordStat) => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    // bid_settings 미존재 시 자동 생성 후 활성화
    if (!kw.bid_setting_id) {
      try {
        await workerFetch('/naver/bid-settings', {
          method: 'POST',
          body: JSON.stringify({
            site_id: siteId,
            keyword: kw.keyword,
            keyword_id: kw.keyword_id ?? `manual_${kw.keyword}`,
            target_rank: 3,
            max_bid: 3000,
            min_bid: 70,
            strategy: 'target_rank',
            is_active: 1,
          }),
        });
        showToast(`"${kw.keyword}" 자동입찰 등록 완료`);
        loadKeywords();
      } catch (e: any) {
        showToast(`등록 실패: ${e?.message ?? ''}`);
      }
      return;
    }
    const next = kw.is_active ? 0 : 1;
    setKeywords((prev) =>
      prev.map((k) => (k.bid_setting_id === kw.bid_setting_id ? { ...k, is_active: next } : k)),
    );
    try {
      await workerFetch(`/naver/bid-settings/${kw.bid_setting_id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: next }),
      });
    } catch (e) {
      showToast('상태 변경 실패');
      loadKeywords();
    }
  };

  const deleteSetting = async (kw: KeywordStat) => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!kw.bid_setting_id) return;
    if (!confirm(`"${kw.keyword}" 자동입찰 설정을 삭제하시겠습니까?`)) return;
    try {
      await workerFetch(`/naver/bid-settings/${kw.bid_setting_id}`, { method: 'DELETE' });
      showToast('삭제 완료');
      loadKeywords();
    } catch (e: any) {
      showToast(`삭제 실패: ${e?.message ?? ''}`);
    }
  };

  const importByScope = async () => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!siteId) return;
    if (filterCampaign === 'all' && filterGroup === 'all') {
      showToast('캠페인 또는 그룹을 먼저 선택하세요');
      return;
    }
    const scopeName =
      filterGroup !== 'all'
        ? campaignsGroups
            .flatMap((c) => c.groups ?? [])
            .find((g) => g.group_id === filterGroup)?.group_name ?? '선택 그룹'
        : campaignsGroups.find((c) => c.campaign_id === filterCampaign)?.campaign_name ?? '선택 캠페인';
    try {
      await workerFetch('/naver/group-strategy/apply', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          campaign_id: filterCampaign !== 'all' ? filterCampaign : undefined,
          group_id: filterGroup !== 'all' ? filterGroup : undefined,
          force: false,
        }),
      });
      const matchedCount = keywords.filter((k) => {
        if (filterGroup !== 'all') return k.group_id === filterGroup;
        return k.campaign_id === filterCampaign;
      }).length;
      showToast(`${scopeName}의 ${matchedCount}개 키워드를 등록했습니다`);
      loadKeywords();
    } catch (e: any) {
      showToast(`불러오기 실패: ${e?.message ?? ''}`);
    }
  };

  const bulkImport = async () => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!siteId || keywords.length === 0) return;
    const targets = keywords.filter((k) => !k.bid_setting_id);
    if (targets.length === 0) {
      showToast('이미 모든 키워드가 등록되어 있습니다');
      return;
    }
    setBulkProgress({ done: 0, total: targets.length });
    let done = 0;
    const tasks = targets.map(async (kw) => {
      try {
        await workerFetch('/naver/bid-settings', {
          method: 'POST',
          body: JSON.stringify({
            site_id: siteId,
            keyword: kw.keyword,
            keyword_id: kw.keyword_id ?? `manual_${kw.keyword}`,
            target_rank: 3,
            max_bid: 3000,
            min_bid: 70,
            strategy: 'target_rank',
            is_active: 1,
          }),
        });
      } catch {
        /* ignore individual failures */
      } finally {
        done += 1;
        setBulkProgress({ done, total: targets.length });
      }
    });
    await Promise.allSettled(tasks);
    setBulkProgress(null);
    showToast(`${done}개 키워드 등록 완료`);
    loadKeywords();
  };

  // 검증: filterGroup 변경 시 매칭 카운트 출력
  useEffect(() => {
    if (filterGroup === 'all') return;
    // eslint-disable-next-line no-console
    console.log(
      'filterGroup:',
      filterGroup,
      'matched:',
      keywords.filter((k) => (k as any).ncc_adgroup_id === filterGroup).length,
    );
  }, [filterGroup, keywords]);

  // 디버그: 그룹 필터링 매칭 확인용 (한 번만)
  const debugLoggedRef = useRef(false);
  useEffect(() => {
    if (debugLoggedRef.current) return;
    if (campaignsGroups.length === 0 || keywords.length === 0) return;
    debugLoggedRef.current = true;
    // eslint-disable-next-line no-console
    console.log('[AutoBid debug] campaignsGroups groupIds:',
      campaignsGroups.flatMap((c) => (c.groups ?? []).map((g) => g.group_id)));
    // eslint-disable-next-line no-console
    console.log('[AutoBid debug] keyword sample (first 5):',
      keywords.slice(0, 5).map((k) => ({
        keyword: k.keyword,
        group_id: k.group_id,
        ncc_adgroup_id: k.ncc_adgroup_id,
        campaign_id: k.campaign_id,
        rawKeys: Object.keys(k),
      })));
  }, [campaignsGroups, keywords]);

  // 견적가 자동 재조회: 첫 로드 완료 후 missing > 0이면 30초 뒤 1회 재조회
  useEffect(() => {
    if (tab !== 'keywords') return;
    if (loadingKw) return;
    if (keywords.length === 0) return;
    if (estimateRefetchedRef.current) return;
    const missing = keywords.filter(
      (k) => k.bid_rank1 == null || k.bid_rank3 == null || k.bid_rank5 == null,
    ).length;
    if (missing === 0) return;
    estimateRefetchedRef.current = true;
    const timer = setTimeout(() => {
      loadKeywords();
    }, 30000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingKw, keywords.length, tab]);

  const filteredKeywords = useMemo(() => {
    return keywords.filter((k) => {
      if (filterCampaign !== 'all') {
        const raw = k as any;
        const cid = raw.ncc_campaign_id ?? raw.campaign_id ?? raw.campaignId ?? '';
        if (cid !== filterCampaign) return false;
      }
      if (filterGroup !== 'all') {
        const raw = k as any;
        const gid = raw.ncc_adgroup_id ?? raw.group_id ?? raw.groupId ?? '';
        if (gid !== filterGroup) return false;
      }
      if (filterDevice !== 'all') {
        const dev = (k.device ?? 'ALL') as Device;
        if (filterDevice === 'PC' && dev === 'M') return false;
        if (filterDevice === 'M' && dev === 'PC') return false;
      }
      if (filterStatus !== 'all') {
        const kind = statusToFilterKind(getStatus(k).kind);
        if (kind !== filterStatus) return false;
      }
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        if (!k.keyword.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [keywords, filterCampaign, filterGroup, filterDevice, filterStatus, searchText]);

  const sortedKeywords = useMemo(() => {
    const list = [...filteredKeywords];
    const stringKeys = new Set(['keyword', 'status_code']);
    list.sort((a, b) => {
      let av: any;
      let bv: any;
      if (sortKey === 'status_code') {
        av = getStatus(a).label;
        bv = getStatus(b).label;
      } else {
        av = (a as any)[sortKey];
        bv = (b as any)[sortKey];
      }
      const isString = stringKeys.has(sortKey) || typeof av === 'string' || typeof bv === 'string';
      if (isString) {
        const sa = (av ?? '') as string;
        const sb = (bv ?? '') as string;
        return sortDir === 'asc' ? sa.localeCompare(sb, 'ko') : sb.localeCompare(sa, 'ko');
      }
      // number/null: null은 항상 맨 뒤
      const na = av == null ? null : Number(av);
      const nb = bv == null ? null : Number(bv);
      if (na == null && nb == null) return 0;
      if (na == null) return 1;
      if (nb == null) return -1;
      return sortDir === 'asc' ? na - nb : nb - na;
    });
    return list;
  }, [filteredKeywords, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const keywordCountsByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const k of keywords) {
      const key = `${k.campaign_id ?? ''}::${k.group_id ?? ''}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [keywords]);

  const strategyByGroupKey = useMemo(() => {
    const map = new Map<string, GroupStrategy>();
    for (const s of groupStrategies) {
      map.set(`${s.campaign_id}::${s.group_id}`, s);
    }
    return map;
  }, [groupStrategies]);

  const groupOptions = useMemo(() => {
    if (filterCampaign === 'all') {
      return campaignsGroups.flatMap((c) => c.groups ?? []);
    }
    return campaignsGroups.find((c) => c.campaign_id === filterCampaign)?.groups ?? [];
  }, [campaignsGroups, filterCampaign]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const eligible = filteredKeywords
      .filter((k) => k.bid_setting_id != null)
      .map((k) => String(k.bid_setting_id));
    setSelectedIds((prev) => {
      if (eligible.every((id) => prev.has(id))) return new Set();
      return new Set(eligible);
    });
  };

  const applyBulkSettings = async (changes: BulkChanges) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkProgress({ done: 0, total: ids.length });
    let done = 0;
    const tasks = ids.map(async (id) => {
      try {
        await workerFetch(`/naver/bid-settings/${id}`, {
          method: 'PUT',
          body: JSON.stringify(changes),
        });
      } catch {
        /* ignore */
      } finally {
        done += 1;
        setBulkProgress({ done, total: ids.length });
      }
    });
    await Promise.allSettled(tasks);
    setBulkProgress(null);
    setShowBulk(false);
    setSelectedIds(new Set());
    showToast(`${done}개 키워드 일괄설정 적용 완료`);
    loadKeywords();
  };

  const updateDeviceInline = async (kw: KeywordStat) => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!kw.bid_setting_id) return;
    const cur = (kw.device ?? 'ALL') as Device;
    const next: Device = cur === 'ALL' ? 'PC' : cur === 'PC' ? 'M' : 'ALL';
    setKeywords((prev) =>
      prev.map((k) => (k.bid_setting_id === kw.bid_setting_id ? { ...k, device: next } : k)),
    );
    try {
      await workerFetch(`/naver/bid-settings/${kw.bid_setting_id}`, {
        method: 'PUT',
        body: JSON.stringify({ device: next }),
      });
    } catch {
      showToast('매체 변경 실패');
      loadKeywords();
    }
  };

  const quickBid = async (kw: KeywordStat, bidAmt: number) => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!kw.ncc_keyword_id && !kw.keyword_id) {
      showToast('네이버 키워드 ID가 없어 즉시 입찰할 수 없습니다');
      return;
    }
    if (!confirm(`${won(bidAmt)}으로 즉시 입찰하시겠습니까?`)) return;
    const id = kw.ncc_keyword_id ?? kw.keyword_id;
    try {
      await workerFetch('/naver', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          method: 'PUT',
          path: `/ncc/keywords/${id}`,
          body: {
            nccKeywordId: id,
            nccAdgroupId: kw.ncc_adgroup_id ?? kw.group_id,
            bidAmt,
            useGroupBidAmt: false,
          },
        }),
      });
      setKeywords((prev) =>
        prev.map((k) => (k.keyword === kw.keyword ? { ...k, current_bid: bidAmt } : k)),
      );
      showToast(`입찰가 ${won(bidAmt)}으로 변경됨`);
    } catch (e: any) {
      showToast(`입찰 실패: ${e?.message ?? ''}`);
    }
  };

  const toggleLowestBidInline = async (kw: KeywordStat) => {
    if (isFree) {
      setShowUpgrade(true);
      return;
    }
    if (!kw.bid_setting_id) return;
    const next = kw.lowest_bid ? 0 : 1;
    setKeywords((prev) =>
      prev.map((k) => (k.bid_setting_id === kw.bid_setting_id ? { ...k, lowest_bid: next } : k)),
    );
    try {
      await workerFetch(`/naver/bid-settings/${kw.bid_setting_id}`, {
        method: 'PUT',
        body: JSON.stringify({ lowest_bid: next }),
      });
    } catch {
      showToast('최저가 입찰 변경 실패');
      loadKeywords();
    }
  };

  const todaySummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = logs.filter((l) => (l.created_at ?? '').slice(0, 10) === today);
    let saved = 0;
    let raised = 0;
    for (const l of todays) {
      const d = (l.new_bid ?? 0) - (l.prev_bid ?? 0);
      if (d > 0) raised += d;
      else if (d < 0) saved += -d;
    }
    return { count: todays.length, saved, raised };
  }, [logs]);

  if (planLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          플랜 정보 확인 중...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {[
          { id: 'keywords' as const, label: '키워드 관리' },
          { id: 'logs' as const, label: '입찰 이력' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isFree && (
        <div className="bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">자동입찰은 Starter 플랜부터 사용할 수 있습니다</h4>
              <p className="text-sm text-gray-600 mt-0.5">
                키워드 50개까지 24시간 자동 관리. CPA 목표 기반 AI 입찰 최적화.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUpgrade(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shrink-0"
          >
            업그레이드
          </button>
        </div>
      )}

      {tab === 'keywords' && (
        <GroupStrategyPanel
          open={groupPanelOpen}
          onToggle={() => setGroupPanelOpen((v) => !v)}
          campaignsGroups={campaignsGroups}
          strategies={groupStrategies}
          activeCampaign={activeCampaign}
          setActiveCampaign={setActiveCampaign}
          keywordCounts={keywordCountsByGroup}
          onEditGroup={(g) => setEditingGroupKey(g)}
          onBulkAllGroups={() => setShowAllGroupsBulk(true)}
          isFree={isFree}
        />
      )}

      {tab === 'keywords' ? (
        <KeywordsTab
          keywords={sortedKeywords}
          totalCount={keywords.length}
          loading={loadingKw}
          loadProgress={loadProgress}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          running={running}
          previewing={previewing}
          isFree={isFree}
          bulkProgress={bulkProgress}
          onBulkImport={bulkImport}
          onAdd={() => (isFree ? setShowUpgrade(true) : setShowAdd(true))}
          onRun={() => runOptimizer(false)}
          onPreview={() => runOptimizer(true)}
          onEdit={(kw) => {
            if (isFree) {
              setShowUpgrade(true);
              return;
            }
            // bid_settings 없으면 add 모드로 모달, 키워드만 미리 채움
            if (!kw.bid_setting_id) {
              setShowAdd(true);
              // 짧은 마운트 후 keywordsText 초기화는 모달 내부에서 처리되므로
              // 여기선 별도 prefill state 없이 사용자 직접 입력으로 둠
              return;
            }
            setEditTarget(kw);
          }}
          onDelete={deleteSetting}
          onToggle={toggleActive}
          campaignsGroups={campaignsGroups}
          groupOptions={groupOptions}
          filterCampaign={filterCampaign}
          setFilterCampaign={(v) => {
            setFilterCampaign(v);
            setFilterGroup('all');
          }}
          filterGroup={filterGroup}
          setFilterGroup={setFilterGroup}
          filterDevice={filterDevice}
          setFilterDevice={setFilterDevice}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          searchText={searchText}
          setSearchText={setSearchText}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onOpenBulk={() => setShowBulk(true)}
          onUpdateDevice={updateDeviceInline}
          onToggleLowestBid={toggleLowestBidInline}
          onQuickBid={quickBid}
          strategyByGroupKey={strategyByGroupKey}
          onImportByScope={importByScope}
        />
      ) : (
        <LogsTab
          logs={logs}
          loading={loadingLogs}
          summary={todaySummary}
          isFree={isFree}
          onUpgrade={() => setShowUpgrade(true)}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <KeywordFormModal
          mode="add"
          siteId={siteId}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            loadKeywords();
            showToast('키워드 추가 완료');
          }}
          existingKeywords={keywords}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <KeywordFormModal
          mode="edit"
          initial={editTarget}
          siteId={siteId}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            loadKeywords();
            showToast('수정 완료');
          }}
        />
      )}

      {/* Group strategy modal */}
      {editingGroupKey && (
        <GroupStrategyModal
          siteId={siteId}
          campaignId={editingGroupKey.campaign_id}
          groupId={editingGroupKey.group_id}
          groupName={editingGroupKey.group_name}
          existing={strategyByGroupKey.get(`${editingGroupKey.campaign_id}::${editingGroupKey.group_id}`)}
          keywordCount={keywordCountsByGroup.get(`${editingGroupKey.campaign_id}::${editingGroupKey.group_id}`) ?? 0}
          onClose={() => setEditingGroupKey(null)}
          onSaved={() => {
            setEditingGroupKey(null);
            loadGroupStrategies();
            showToast('그룹 전략 저장 완료');
          }}
          onApplyToAll={(n) => {
            setEditingGroupKey(null);
            loadKeywords();
            showToast(`${n}개 키워드에 그룹 전략 적용 완료`);
          }}
        />
      )}

      {/* All-groups bulk modal */}
      {showAllGroupsBulk && (
        <GroupStrategyModal
          siteId={siteId}
          campaignId="*"
          groupId="*"
          groupName={`전체 그룹 (${campaignsGroups.reduce((acc, c) => acc + (c.groups?.length ?? 0), 0)}개)`}
          keywordCount={keywords.length}
          allGroupsMode
          campaignsGroups={campaignsGroups}
          onClose={() => setShowAllGroupsBulk(false)}
          onSaved={() => {
            setShowAllGroupsBulk(false);
            loadGroupStrategies();
            showToast('전체 그룹 전략 저장 완료');
          }}
          onApplyToAll={(n) => {
            setShowAllGroupsBulk(false);
            loadKeywords();
            loadGroupStrategies();
            showToast(`${n}개 키워드에 일괄 적용 완료`);
          }}
        />
      )}

      {/* Bulk settings modal */}
      {showBulk && (
        <BulkSettingsModal
          count={selectedIds.size}
          onClose={() => setShowBulk(false)}
          onApply={applyBulkSettings}
          progress={bulkProgress}
        />
      )}

      {/* Preview modal */}
      {previewResult && (
        <PreviewModal
          result={previewResult}
          onClose={() => setPreviewResult(null)}
          onApply={applyPreview}
          applying={running}
        />
      )}

      {showUpgrade && (
        <UpgradePrompt
          feature="자동입찰"
          description="자동입찰은 Starter 플랜부터 사용할 수 있습니다. 지금 업그레이드하면 키워드 50개까지 24시간 자동 관리됩니다."
          onClose={() => setShowUpgrade(false)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- Sortable Header ---------- */

function SortHeader(props: {
  label: string;
  sortKey: string;
  align: 'left' | 'center' | 'right';
  current: string;
  dir: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const { label, sortKey, align, current, dir, onSort } = props;
  const active = current === sortKey;
  const alignCls = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  const justify =
    align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  return (
    <th className={`px-2 py-3 font-medium ${alignCls}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 w-full ${justify} hover:text-blue-600 transition-colors ${
          active ? 'text-blue-600' : 'text-gray-400'
        }`}
      >
        <span>{label}</span>
        <span className="text-[9px]">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

/* ---------- Keywords Tab ---------- */

interface KeywordsTabProps {
  keywords: KeywordStat[];
  totalCount: number;
  loading: boolean;
  loadProgress: { loaded: number; total: number | null } | null;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  running: boolean;
  previewing: boolean;
  isFree: boolean;
  bulkProgress: { done: number; total: number } | null;
  onBulkImport: () => void;
  onAdd: () => void;
  onRun: () => void;
  onPreview: () => void;
  onEdit: (kw: KeywordStat) => void;
  onDelete: (kw: KeywordStat) => void;
  onToggle: (kw: KeywordStat) => void;
  campaignsGroups: CampaignGroup[];
  groupOptions: { group_id: string; group_name: string }[];
  filterCampaign: string;
  setFilterCampaign: (v: string) => void;
  filterGroup: string;
  setFilterGroup: (v: string) => void;
  filterDevice: Device | 'all';
  setFilterDevice: (v: Device | 'all') => void;
  filterStatus: StatusFilter;
  setFilterStatus: (v: StatusFilter) => void;
  searchText: string;
  setSearchText: (v: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenBulk: () => void;
  onUpdateDevice: (kw: KeywordStat) => void;
  onToggleLowestBid: (kw: KeywordStat) => void;
  onQuickBid: (kw: KeywordStat, bidAmt: number) => void;
  strategyByGroupKey: Map<string, GroupStrategy>;
  onImportByScope: () => void;
}

function KeywordsTab(props: KeywordsTabProps) {
  const {
    keywords, totalCount, loading, loadProgress, sortKey, sortDir, onSort,
    running, previewing, isFree,
    bulkProgress, onBulkImport, onAdd, onRun, onPreview, onEdit, onDelete, onToggle,
    campaignsGroups, groupOptions,
    filterCampaign, setFilterCampaign, filterGroup, setFilterGroup,
    filterDevice, setFilterDevice, filterStatus, setFilterStatus,
    searchText, setSearchText,
    selectedIds, onToggleSelect, onToggleSelectAll, onOpenBulk,
    onUpdateDevice, onToggleLowestBid, onQuickBid, strategyByGroupKey, onImportByScope,
  } = props;
  const eligibleSelectable = keywords.filter((k) => k.bid_setting_id != null);
  const allSelected =
    eligibleSelectable.length > 0 &&
    eligibleSelectable.every((k) => selectedIds.has(String(k.bid_setting_id)));

  return (
    <div className="space-y-4">
      {isFree && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Eye className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 leading-relaxed">
            현재 광고 현황을 확인하고 있습니다.
            <br />
            <span className="text-blue-700">자동입찰을 실행하려면 Starter 플랜으로 업그레이드하세요.</span>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-2 flex-wrap">
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
        >
          <option value="all">캠페인: 전체</option>
          {campaignsGroups.map((c) => (
            <option key={c.campaign_id} value={c.campaign_id}>{c.campaign_name}</option>
          ))}
        </select>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
        >
          <option value="all">그룹: 전체</option>
          {groupOptions.map((g) => (
            <option key={g.group_id} value={g.group_id}>{g.group_name}</option>
          ))}
        </select>
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
          {(['all', 'PC', 'M'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setFilterDevice(d)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                filterDevice === d ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500'
              }`}
            >
              {d === 'all' ? '전체' : d === 'PC' ? 'PC' : '모바일'}
            </button>
          ))}
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">상태: 전체</option>
          <option value="normal">정상</option>
          <option value="no_impression">노출없음</option>
          <option value="paused">광고중지</option>
          <option value="max_reached">최대도달</option>
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="키워드 검색..."
            className="w-full text-xs border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(filterCampaign !== 'all' || filterGroup !== 'all') && (
          <button
            onClick={onImportByScope}
            disabled={isFree}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
            title={filterGroup !== 'all' ? '이 그룹의 모든 키워드를 자동입찰에 등록' : '이 캠페인의 모든 키워드를 자동입찰에 등록'}
          >
            {isFree ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            {filterGroup !== 'all' ? '이 그룹 불러오기' : '이 캠페인 불러오기'}
          </button>
        )}
        {selectedIds.size > 0 && (
          <button
            onClick={onOpenBulk}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Settings2 className="w-3.5 h-3.5" />
            선택 항목 일괄설정 ({selectedIds.size})
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {/* Action bar */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold text-gray-900">
            키워드 자동입찰 ({keywords.length}{totalCount !== keywords.length ? ` / ${totalCount}` : ''}개)
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onPreview}
              disabled={previewing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              미리보기
            </button>
            <button
              onClick={onRun}
              disabled={running}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-50 ${
                isFree
                  ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isFree ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              지금 실행
            </button>
            <button
              onClick={onBulkImport}
              disabled={!!bulkProgress || keywords.length === 0}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-50 ${
                isFree
                  ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
              title="네이버에서 가져온 모든 키워드를 자동입찰에 일괄 등록"
            >
              {bulkProgress ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isFree ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {bulkProgress ? `등록 중... ${bulkProgress.done}/${bulkProgress.total}` : '전체 불러오기'}
            </button>
            <button
              onClick={onAdd}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg ${
                isFree
                  ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isFree ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              키워드 추가
            </button>
          </div>
        </div>

      {loading && keywords.length > 0 && loadProgress && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          키워드 로딩 중... ({loadProgress.loaded}{loadProgress.total ? `/${loadProgress.total}` : ''}개)
        </div>
      )}
      {loading && keywords.length === 0 ? (
        <div className="p-12 text-center text-sm text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
          {loadProgress
            ? `키워드 로딩 중... (${loadProgress.loaded}${loadProgress.total ? `/${loadProgress.total}` : ''}개)`
            : '불러오는 중...'}
        </div>
      ) : keywords.length === 0 ? (
        <div className="p-12 text-center text-sm text-gray-400">
          등록된 키워드가 없습니다. "키워드 추가"로 시작하세요.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    disabled={isFree || eligibleSelectable.length === 0}
                    className="rounded border-gray-300"
                  />
                </th>
                <SortHeader label="키워드" sortKey="keyword" align="left" current={sortKey} dir={sortDir} onSort={onSort} />
                <th className="px-2 py-3 font-medium text-center">매체</th>
                <SortHeader label="PC검색" sortKey="monthly_pc" align="right" current={sortKey} dir={sortDir} onSort={onSort} />
                <SortHeader label="MO검색" sortKey="monthly_mobile" align="right" current={sortKey} dir={sortDir} onSort={onSort} />
                <SortHeader label="품질" sortKey="qi_grade" align="center" current={sortKey} dir={sortDir} onSort={onSort} />
                <SortHeader label="현재순위" sortKey="current_rank" align="center" current={sortKey} dir={sortDir} onSort={onSort} />
                <SortHeader label="1위" sortKey="bid_rank1" align="right" current={sortKey} dir={sortDir} onSort={onSort} />
                <SortHeader label="3위" sortKey="bid_rank3" align="right" current={sortKey} dir={sortDir} onSort={onSort} />
                <SortHeader label="5위" sortKey="bid_rank5" align="right" current={sortKey} dir={sortDir} onSort={onSort} />
                <SortHeader label="현재입찰가" sortKey="current_bid" align="right" current={sortKey} dir={sortDir} onSort={onSort} />
                <SortHeader label="상태" sortKey="status_code" align="center" current={sortKey} dir={sortDir} onSort={onSort} />
                <th className="px-3 py-3 font-medium text-center">최저가</th>
                <th className="px-3 py-3 font-medium text-center">ON/OFF</th>
                <th className="px-3 py-3 font-medium text-center">액션</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, i) => {
                const status = getStatus(kw);
                const hasSetting = !!kw.bid_setting_id;
                const isActive = !!kw.is_active;
                const idStr = String(kw.bid_setting_id ?? '');
                const checked = selectedIds.has(idStr);
                const dev = (kw.device ?? 'ALL') as Device;
                const lowestOn = !!kw.lowest_bid;
                // 그룹 전략 매칭: 키워드와 group_id가 정확히 일치할 때만 상속
                const hasGroupId = !!(kw.group_id && kw.group_id !== '*');
                const groupKey = hasGroupId ? `${kw.campaign_id ?? ''}::${kw.group_id}` : '';
                const groupStrat = hasGroupId ? strategyByGroupKey.get(groupKey) : undefined;
                // 추가 가드: strategy의 group_id가 와일드카드(*)인 경우 상속 금지
                const validGroupStrat = groupStrat && groupStrat.group_id !== '*' ? groupStrat : undefined;
                const sourceLabel = hasSetting ? '' : validGroupStrat ? '(그룹)' : '(기본)';
                const sourceCls = hasSetting ? '' : validGroupStrat ? 'text-gray-500' : 'text-gray-300';
                return (
                  <tr key={`${kw.keyword}-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!hasSetting || isFree}
                        onChange={() => onToggleSelect(idStr)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {(() => {
                        const groupKey = `${kw.campaign_id ?? ''}::${kw.group_id ?? ''}`;
                        const groupStrat = strategyByGroupKey.get(groupKey);
                        const hasIndividual = !!kw.bid_setting_id;
                        if (hasIndividual) {
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" title="개별설정" />
                              {kw.keyword}
                            </span>
                          );
                        }
                        if (groupStrat) {
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                title={`그룹 상속: ${kw.group_name ?? kw.group_id ?? ''}`}
                              />
                              {kw.keyword}
                            </span>
                          );
                        }
                        return kw.keyword;
                      })()}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => onUpdateDevice(kw)}
                        disabled={!hasSetting}
                        title={`매체: ${dev === 'ALL' ? '전체' : dev === 'PC' ? 'PC' : '모바일'} (클릭으로 토글)`}
                        className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {dev === 'ALL' ? (
                          <>
                            <Monitor className="w-3 h-3 text-blue-500" />
                            <Smartphone className="w-3 h-3 text-violet-500" />
                          </>
                        ) : dev === 'PC' ? (
                          <Monitor className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5 text-violet-500" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-3 text-right text-xs text-gray-700">
                      {kw.monthly_pc == null ? <span className="text-gray-300">-</span> : kw.monthly_pc.toLocaleString()}
                    </td>
                    <td className="px-2 py-3 text-right text-xs text-gray-700">
                      {kw.monthly_mobile == null ? <span className="text-gray-300">-</span> : kw.monthly_mobile.toLocaleString()}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {kw.qi_grade == null ? (
                        <span className="text-gray-300 text-xs">-</span>
                      ) : (
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold ${
                            kw.qi_grade >= 7
                              ? 'bg-green-100 text-green-700'
                              : kw.qi_grade >= 4
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {kw.qi_grade}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700">
                      {kw.current_rank == null ? (
                        <span className="text-gray-400">노출없음</span>
                      ) : (
                        `${kw.current_rank}위`
                      )}
                    </td>
                    {[1, 3, 5].map((rank) => {
                      const bid = rank === 1 ? kw.bid_rank1 : rank === 3 ? kw.bid_rank3 : kw.bid_rank5;
                      const isTarget = kw.target_rank === rank;
                      if (bid == null) {
                        return (
                          <td key={rank} className="px-2 py-3 text-right">
                            <span
                              className="inline-block w-12 h-3.5 rounded bg-gray-200 animate-pulse"
                              title="견적가 조회 중..."
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={rank} className="px-2 py-3 text-right">
                          <button
                            onClick={() => onQuickBid(kw, bid)}
                            disabled={isFree}
                            className={`text-xs font-medium px-1.5 py-0.5 rounded transition-colors ${
                              isTarget
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'text-gray-700 hover:bg-gray-100'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={`${won(bid)}으로 즉시 입찰`}
                          >
                            {won(bid)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right text-gray-700">
                      {won(kw.current_bid)}
                      {(() => {
                        const effTarget = kw.target_rank ?? validGroupStrat?.target_rank ?? null;
                        if (effTarget == null) return null;
                        return (
                          <span className="block text-[10px] text-gray-400">
                            목표 {effTarget}위
                            {sourceLabel && <span className={`ml-1 ${sourceCls}`}>{sourceLabel}</span>}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        title={status.tooltip}
                        className={`text-[10px] font-medium px-2 py-1 rounded-full border ${status.cls} inline-flex items-center gap-1`}
                      >
                        {status.kind === 'user_locked' && <Lock className="w-2.5 h-2.5" />}
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {hasSetting ? (
                        <button
                          onClick={() => onToggleLowestBid(kw)}
                          disabled={isFree}
                          className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors ${
                            isFree ? 'bg-gray-200 cursor-not-allowed' : lowestOn ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          title={lowestOn ? '최저가 입찰 ON' : '최저가 입찰 OFF'}
                        >
                          <span
                            className={`inline-flex items-center justify-center w-3.5 h-3.5 bg-white rounded-full shadow transform transition-transform ${
                              lowestOn ? 'translate-x-[18px]' : 'translate-x-[3px]'
                            }`}
                          >
                            {lowestOn && <Zap className="w-2 h-2 text-green-600" />}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => onToggle(kw)}
                        title={
                          isFree
                            ? '자동입찰은 Starter부터'
                            : !hasSetting
                            ? '클릭하여 자동입찰 등록'
                            : ''
                        }
                        className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors ${
                          isFree
                            ? 'bg-gray-300 cursor-not-allowed'
                            : !hasSetting
                            ? 'bg-gray-200 hover:bg-gray-300'
                            : isActive
                            ? 'bg-blue-600'
                            : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block w-3.5 h-3.5 bg-white rounded-full shadow transform transition-transform ${
                            !isFree && hasSetting && isActive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onEdit(kw)}
                          className={`p-1.5 rounded ${
                            isFree
                              ? 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                              : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title={isFree ? '자동입찰은 Starter부터' : '수정'}
                        >
                          {isFree ? <Lock className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                        </button>
                        {hasSetting && (
                          <button
                            onClick={() => onDelete(kw)}
                            className={`p-1.5 rounded ${
                              isFree
                                ? 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={isFree ? '자동입찰은 Starter부터' : '삭제'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}

/* ---------- Logs Tab ---------- */

function LogsTab(props: {
  logs: BidLog[];
  loading: boolean;
  summary: { count: number; saved: number; raised: number };
  isFree: boolean;
  onUpgrade: () => void;
}) {
  const { logs, loading, summary, isFree, onUpgrade } = props;
  const visibleLogs = isFree ? logs.slice(0, 3) : logs;
  const blurredLogs = isFree ? logs.slice(3, 8) : [];

  const cards = [
    { label: '오늘 조정 건수', value: `${summary.count}건`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '오늘 절감 금액', value: won(summary.saved), icon: TrendingDown, color: 'text-green-600', bg: 'bg-green-50' },
    { label: '오늘 상향 금액', value: won(summary.raised), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mt-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">입찰 변경 이력</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            불러오는 중...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">아직 입찰 변경 이력이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-medium">시간</th>
                  <th className="px-3 py-3 font-medium">키워드</th>
                  <th className="px-3 py-3 font-medium text-right">이전</th>
                  <th className="px-3 py-3 font-medium text-right">신규</th>
                  <th className="px-3 py-3 font-medium text-right">변경액</th>
                  <th className="px-3 py-3 font-medium text-center">순위</th>
                  <th className="px-3 py-3 font-medium">전략</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((l) => {
                  const delta = (l.new_bid ?? 0) - (l.prev_bid ?? 0);
                  const up = delta > 0;
                  const down = delta < 0;
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {(l.created_at ?? '').replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-800">{l.keyword}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{won(l.prev_bid)}</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(l.new_bid)}</td>
                      <td
                        className={`px-3 py-3 text-right font-semibold ${
                          up ? 'text-red-600' : down ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {up ? '+' : ''}
                        {won(delta).replace('₩', delta < 0 ? '-₩' : '₩').replace('-₩-', '-₩')}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">
                        {l.current_rank ?? '-'}위 → {l.target_rank ?? '-'}위
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{l.strategy}</td>
                    </tr>
                  );
                })}
                {isFree &&
                  blurredLogs.map((l) => (
                    <tr key={`blur-${l.id}`} className="border-b border-gray-50" style={{ filter: 'blur(4px)', userSelect: 'none' }}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {(l.created_at ?? '').replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-800">{l.keyword}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{won(l.prev_bid)}</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(l.new_bid)}</td>
                      <td className="px-3 py-3 text-right text-gray-500">-</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">-</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{l.strategy}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {isFree && logs.length > 3 && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gradient-to-r from-blue-50 to-violet-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Lock className="w-4 h-4 text-blue-600" />
              전체 이력은 Starter 플랜부터 확인할 수 있습니다
            </div>
            <button
              onClick={onUpgrade}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
            >
              업그레이드
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Keyword Add/Edit Modal (Tabbed) ---------- */

type FormTab = 'basic' | 'time';

function KeywordFormModal(props: {
  mode: 'add' | 'edit';
  initial?: KeywordStat;
  existingKeywords?: KeywordStat[];
  siteId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mode, initial, existingKeywords, siteId, onClose, onSaved } = props;
  const [formTab, setFormTab] = useState<FormTab>('basic');
  const [keywordsText, setKeywordsText] = useState(initial?.keyword ?? '');
  const [targetRank, setTargetRank] = useState<number>(initial?.target_rank ?? 3);
  const [maxBid, setMaxBid] = useState<number>(initial?.max_bid ?? 3000);
  const [minBid, setMinBid] = useState<number>(initial?.min_bid ?? 70);
  const [strategy, setStrategy] = useState<string>(initial?.strategy ?? 'target_rank');
  const [device, setDevice] = useState<Device>((initial?.device as Device) ?? 'ALL');
  const [lowestBid, setLowestBid] = useState<boolean>(!!initial?.lowest_bid);
  const [lowestBidWaitMin, setLowestBidWaitMin] = useState<number>(initial?.lowest_bid_wait_min ?? 10);

  const initialSchedule = (() => {
    const raw = initial?.hourly_schedule;
    if (!raw) return {} as HourSchedule;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as HourSchedule; } catch { return {}; }
    }
    return raw;
  })();
  const [schedule, setSchedule] = useState<HourSchedule>(initialSchedule);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setHour = (h: number, val: number | 'stop') => {
    setSchedule((prev) => ({ ...prev, [h]: val }));
  };
  const applyPreset = (preset: 'peak' | 'night' | 'all3') => {
    const next: HourSchedule = {};
    if (preset === 'peak') {
      for (let h = 9; h <= 18; h++) next[h] = 1;
    } else if (preset === 'night') {
      for (let h = 22; h <= 23; h++) next[h] = 'stop';
      for (let h = 0; h <= 8; h++) next[h] = 'stop';
    } else {
      for (let h = 0; h < 24; h++) next[h] = 3;
    }
    setSchedule((prev) => ({ ...prev, ...next }));
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const commonPayload = {
        target_rank: targetRank,
        max_bid: maxBid,
        min_bid: minBid,
        strategy,
        device,
        lowest_bid: lowestBid ? 1 : 0,
        lowest_bid_wait_min: lowestBidWaitMin,
        hourly_schedule: JSON.stringify(schedule),
      };
      if (mode === 'edit' && initial?.bid_setting_id) {
        await workerFetch(`/naver/bid-settings/${initial.bid_setting_id}`, {
          method: 'PUT',
          body: JSON.stringify(commonPayload),
        });
      } else {
        const list = keywordsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (list.length === 0) throw new Error('키워드를 1개 이상 입력하세요');
        for (const kw of list) {
          const found = existingKeywords?.find((k) => k.keyword === kw);
          await workerFetch('/naver/bid-settings', {
            method: 'POST',
            body: JSON.stringify({
              site_id: siteId,
              keyword: kw,
              keyword_id: found?.keyword_id ?? `manual_${kw}`,
              is_active: 1,
              ...commonPayload,
            }),
          });
        }
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {mode === 'add' ? '키워드 추가' : `"${initial?.keyword}" 설정 수정`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form tabs */}
        <div className="px-6 border-b border-gray-100 flex items-center gap-1">
          {([
            { id: 'basic', label: '기본 설정' },
            { id: 'time', label: '시간대 전략' },
          ] as { id: FormTab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setFormTab(t.id)}
              className={`text-sm px-3 py-2.5 -mb-px border-b-2 transition-colors ${
                formTab === t.id ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {formTab === 'basic' && (
            <div className="space-y-4">
              {mode === 'add' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    키워드 (여러 개는 줄바꿈으로 구분)
                  </label>
                  <textarea
                    value={keywordsText}
                    onChange={(e) => setKeywordsText(e.target.value)}
                    rows={4}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">목표 순위</label>
                  <select
                    value={targetRank}
                    onChange={(e) => setTargetRank(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}위</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">매체</label>
                  <select
                    value={device}
                    onChange={(e) => setDevice(e.target.value as Device)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">전체 (PC + 모바일)</option>
                    <option value="PC">PC 전용</option>
                    <option value="M">모바일 전용</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">최대 입찰가 (원)</label>
                  <input
                    type="number"
                    value={maxBid}
                    onChange={(e) => setMaxBid(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">최소 입찰가 (원)</label>
                  <input
                    type="number"
                    value={minBid}
                    onChange={(e) => setMinBid(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">전략</label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="target_rank">목표순위 유지</option>
                    <option value="max_efficiency">최대 효율</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">최저가 대기시간 (분)</label>
                  <input
                    type="number"
                    value={lowestBidWaitMin}
                    onChange={(e) => setLowestBidWaitMin(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowestBid}
                  onChange={(e) => setLowestBid(e.target.checked)}
                  className="rounded border-gray-300"
                />
                최저가 입찰 사용 (목표 미달 시 최저가로 자동 입찰)
              </label>
            </div>
          )}

          {formTab === 'time' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500">빠른 설정:</span>
                <button onClick={() => applyPreset('peak')} className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100">
                  피크타임(9~18시) 1위
                </button>
                <button onClick={() => applyPreset('night')} className="text-xs px-3 py-1 bg-gray-50 text-gray-700 rounded border border-gray-200 hover:bg-gray-100">
                  야간(22~8시) 중지
                </button>
                <button onClick={() => applyPreset('all3')} className="text-xs px-3 py-1 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100">
                  전시간 3위
                </button>
                <button onClick={() => setSchedule({})} className="text-xs px-3 py-1 bg-white text-gray-500 rounded border border-gray-200 hover:bg-gray-50">
                  초기화
                </button>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {Array.from({ length: 24 }, (_, h) => {
                  const v = schedule[h];
                  const cls =
                    v === 'stop' ? 'bg-gray-300 text-gray-700' :
                    typeof v === 'number' && v <= 2 ? 'bg-blue-500 text-white' :
                    typeof v === 'number' && v <= 5 ? 'bg-green-500 text-white' :
                    typeof v === 'number' && v <= 10 ? 'bg-yellow-400 text-yellow-900' :
                    'bg-white border border-gray-200 text-gray-400';
                  return (
                    <div key={h} className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 mb-1">{h}시</span>
                      <select
                        value={v == null ? '' : String(v)}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setSchedule((prev) => {
                              const next = { ...prev };
                              delete next[h];
                              return next;
                            });
                          } else if (val === 'stop') {
                            setHour(h, 'stop');
                          } else {
                            setHour(h, Number(val));
                          }
                        }}
                        className={`text-[10px] font-bold rounded w-full text-center py-1 border-0 cursor-pointer ${cls}`}
                      >
                        <option value="">-</option>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}위</option>
                        ))}
                        <option value="stop">중지</option>
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" /> 1~2위</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> 3~5위</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-400" /> 6~10위</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-300" /> 중지</div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'add' ? '추가' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bulk Settings Modal ---------- */

interface BulkChanges {
  target_rank?: number;
  max_bid?: number;
  device?: Device;
  lowest_bid?: number;
}

function BulkSettingsModal(props: {
  count: number;
  onClose: () => void;
  onApply: (changes: BulkChanges) => void;
  progress: { done: number; total: number } | null;
}) {
  const { count, onClose, onApply, progress } = props;
  const [useTargetRank, setUseTargetRank] = useState(false);
  const [useMaxBid, setUseMaxBid] = useState(false);
  const [useDevice, setUseDevice] = useState(false);
  const [useLowestBid, setUseLowestBid] = useState(false);
  const [targetRank, setTargetRank] = useState(3);
  const [maxBid, setMaxBid] = useState(3000);
  const [device, setDevice] = useState<Device>('ALL');
  const [lowestBid, setLowestBid] = useState(false);

  const handleApply = () => {
    const changes: BulkChanges = {};
    if (useTargetRank) changes.target_rank = targetRank;
    if (useMaxBid) changes.max_bid = maxBid;
    if (useDevice) changes.device = device;
    if (useLowestBid) changes.lowest_bid = lowestBid ? 1 : 0;
    if (Object.keys(changes).length === 0) return;
    onApply(changes);
  };

  const Row = ({
    enabled, setEnabled, label, children,
  }: { enabled: boolean; setEnabled: (v: boolean) => void; label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        className="rounded border-gray-300 mt-2"
      />
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-700 mb-1">{label}</p>
        <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>{children}</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 mb-1">선택 항목 일괄설정</h3>
        <p className="text-xs text-gray-500 mb-4">{count}개 키워드에 일괄 적용합니다.</p>

        <Row enabled={useTargetRank} setEnabled={setUseTargetRank} label="목표순위 변경">
          <select
            value={targetRank}
            onChange={(e) => setTargetRank(Number(e.target.value))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}위</option>
            ))}
          </select>
        </Row>
        <Row enabled={useMaxBid} setEnabled={setUseMaxBid} label="최대입찰가 변경 (원)">
          <input
            type="number"
            value={maxBid}
            onChange={(e) => setMaxBid(Number(e.target.value))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          />
        </Row>
        <Row enabled={useDevice} setEnabled={setUseDevice} label="매체 변경">
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value as Device)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="ALL">전체</option>
            <option value="PC">PC</option>
            <option value="M">모바일</option>
          </select>
        </Row>
        <Row enabled={useLowestBid} setEnabled={setUseLowestBid} label="최저가 입찰">
          <select
            value={lowestBid ? 'on' : 'off'}
            onChange={(e) => setLowestBid(e.target.value === 'on')}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="on">ON</option>
            <option value="off">OFF</option>
          </select>
        </Row>

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={!!progress || (!useTargetRank && !useMaxBid && !useDevice && !useLowestBid)}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {progress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {progress.done}/{progress.total}
              </>
            ) : (
              `${count}개 적용`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Preview Modal ---------- */

function PreviewModal(props: {
  result: OptimizerResponse;
  onClose: () => void;
  onApply: () => void;
  applying: boolean;
}) {
  const { result, onClose, onApply, applying } = props;
  const items = result.results ?? [];
  const changed = result.changed ?? items.filter((i) => i.action === 'raise' || i.action === 'lower').length;
  const kept = result.kept ?? items.filter((i) => i.action === 'keep').length;
  const skipped = result.skipped ?? items.filter((i) => i.action === 'skip').length;

  const rowBg = (a: OptimizerResultItem['action']) =>
    a === 'raise' ? 'bg-red-50/60' : a === 'lower' ? 'bg-green-50/60' : a === 'skip' ? 'bg-gray-50' : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">미리보기 결과</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {changed}개 변경 예정 · {kept}개 유지 · {skipped}개 스킵
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {items.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">변경 대상이 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs text-gray-400">
                  <th className="px-4 py-3 font-medium">키워드</th>
                  <th className="px-3 py-3 font-medium text-right">현재</th>
                  <th className="px-3 py-3 font-medium text-right">변경 후</th>
                  <th className="px-3 py-3 font-medium text-center">순위</th>
                  <th className="px-3 py-3 font-medium">사유</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const Icon =
                    it.action === 'raise' ? TrendingUp : it.action === 'lower' ? TrendingDown : Minus;
                  const iconCls =
                    it.action === 'raise'
                      ? 'text-red-600'
                      : it.action === 'lower'
                      ? 'text-green-600'
                      : 'text-gray-400';
                  return (
                    <tr key={i} className={`border-b border-gray-50 ${rowBg(it.action)}`}>
                      <td className="px-4 py-3 font-medium text-gray-800 flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${iconCls}`} />
                        {it.keyword}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">{won(it.current_bid)}</td>
                      <td className="px-3 py-3 text-right text-gray-900 font-semibold">{won(it.new_bid)}</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">
                        {it.current_rank ?? '-'}위 → {it.target_rank ?? '-'}위
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{it.reason ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            닫기
          </button>
          <button
            onClick={onApply}
            disabled={applying || changed === 0}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {applying && <Loader2 className="w-4 h-4 animate-spin" />}
            실제 적용 ({changed}개)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Group Strategy Panel ---------- */

function GroupStrategyPanel(props: {
  open: boolean;
  onToggle: () => void;
  campaignsGroups: CampaignGroup[];
  strategies: GroupStrategy[];
  activeCampaign: string;
  setActiveCampaign: (id: string) => void;
  keywordCounts: Map<string, number>;
  onEditGroup: (g: { campaign_id: string; group_id: string; group_name: string }) => void;
  onBulkAllGroups: () => void;
  isFree: boolean;
}) {
  const {
    open, onToggle, campaignsGroups, strategies, activeCampaign, setActiveCampaign,
    keywordCounts, onEditGroup, onBulkAllGroups, isFree,
  } = props;

  const stratMap = useMemo(() => {
    const m = new Map<string, GroupStrategy>();
    for (const s of strategies) m.set(`${s.campaign_id}::${s.group_id}`, s);
    return m;
  }, [strategies]);

  const activeGroups = campaignsGroups.find((c) => c.campaign_id === activeCampaign)?.groups ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-violet-600" />
          <h3 className="font-semibold text-gray-900">그룹별 전략 설정</h3>
          <span className="text-xs text-gray-400">({strategies.length}개 그룹 설정됨)</span>
        </div>
        <span className="text-xs text-gray-400">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {campaignsGroups.length === 0 ? (
                <span className="text-xs text-gray-400">캠페인이 없습니다</span>
              ) : (
                campaignsGroups.map((c) => (
                  <button
                    key={c.campaign_id}
                    onClick={() => setActiveCampaign(c.campaign_id)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      activeCampaign === c.campaign_id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {c.campaign_name}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={onBulkAllGroups}
              disabled={isFree || campaignsGroups.length === 0}
              className="text-xs px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
            >
              {isFree ? <Lock className="w-3 h-3" /> : <Settings2 className="w-3 h-3" />}
              전체 그룹 일괄 설정
            </button>
          </div>

          <div className="p-5">
            {activeGroups.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-6">선택된 캠페인에 그룹이 없습니다</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeGroups.map((g) => {
                  const key = `${activeCampaign}::${g.group_id}`;
                  const strat = stratMap.get(key);
                  const kwCount = keywordCounts.get(key) ?? 0;
                  return (
                    <div
                      key={g.group_id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="text-sm font-semibold text-gray-900 truncate">{g.group_name}</p>
                        <button
                          onClick={() =>
                            onEditGroup({ campaign_id: activeCampaign, group_id: g.group_id, group_name: g.group_name })
                          }
                          disabled={isFree}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        >
                          {isFree ? <Lock className="w-3 h-3" /> : '설정'}
                        </button>
                      </div>
                      {strat ? (
                        <div className="space-y-1 text-xs text-gray-600">
                          <p>
                            목표순위: <span className="font-semibold text-gray-900">{strat.target_rank}위</span> · 최대:{' '}
                            <span className="font-semibold text-gray-900">{won(strat.max_bid)}</span>
                          </p>
                          <p>
                            매체:{' '}
                            <span className="font-semibold text-gray-900">
                              {strat.device === 'ALL' ? '전체' : strat.device === 'PC' ? 'PC' : '모바일'}
                            </span>{' '}
                            · 최저가입찰:{' '}
                            <span className={`font-semibold ${strat.lowest_bid ? 'text-green-600' : 'text-gray-400'}`}>
                              {strat.lowest_bid ? 'ON' : 'OFF'}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">전략 미설정</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-100">키워드 {kwCount}개</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Group Strategy Modal ---------- */

function GroupStrategyModal(props: {
  siteId: string;
  campaignId: string;
  groupId: string;
  groupName: string;
  existing?: GroupStrategy;
  keywordCount: number;
  allGroupsMode?: boolean;
  campaignsGroups?: CampaignGroup[];
  onClose: () => void;
  onSaved: () => void;
  onApplyToAll: (n: number) => void;
}) {
  const {
    siteId, campaignId, groupId, groupName, existing, keywordCount,
    allGroupsMode, campaignsGroups,
    onClose, onSaved, onApplyToAll,
  } = props;
  const [targetRank, setTargetRank] = useState<number>(existing?.target_rank ?? 3);
  const [maxBid, setMaxBid] = useState<number>(existing?.max_bid ?? 3000);
  const [minBid, setMinBid] = useState<number>(existing?.min_bid ?? 70);
  const [device, setDevice] = useState<Device>(existing?.device ?? 'ALL');
  const [lowestBid, setLowestBid] = useState<boolean>(!!existing?.lowest_bid);
  const [hourlyPreset, setHourlyPreset] = useState<'peak' | 'night' | 'all3' | ''>(existing?.hourly_preset ?? '');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPayload = () => ({
    site_id: siteId,
    campaign_id: campaignId,
    group_id: groupId,
    target_rank: targetRank,
    max_bid: maxBid,
    min_bid: minBid,
    device,
    lowest_bid: lowestBid ? 1 : 0,
    hourly_preset: hourlyPreset || null,
  });

  const allGroupTargets = useMemo(() => {
    if (!allGroupsMode || !campaignsGroups) return [];
    const out: { campaign_id: string; group_id: string }[] = [];
    for (const c of campaignsGroups) {
      for (const g of c.groups ?? []) {
        out.push({ campaign_id: c.campaign_id, group_id: g.group_id });
      }
    }
    return out;
  }, [allGroupsMode, campaignsGroups]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      if (allGroupsMode) {
        await Promise.allSettled(
          allGroupTargets.map((t) =>
            workerFetch('/naver/group-strategy', {
              method: 'POST',
              body: JSON.stringify({ ...buildPayload(), campaign_id: t.campaign_id, group_id: t.group_id }),
            }),
          ),
        );
      } else {
        await workerFetch('/naver/group-strategy', {
          method: 'POST',
          body: JSON.stringify(buildPayload()),
        });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToAll = async () => {
    const confirmMsg = allGroupsMode
      ? `전체 ${allGroupTargets.length}개 그룹의 ${keywordCount}개 키워드에 전략을 적용합니다. 계속하시겠습니까?`
      : `이 그룹의 ${keywordCount}개 키워드에 전략을 적용합니다. 계속하시겠습니까?`;
    if (!confirm(confirmMsg)) return;
    setError(null);
    setApplying(true);
    try {
      if (allGroupsMode) {
        await Promise.allSettled(
          allGroupTargets.map((t) =>
            workerFetch('/naver/group-strategy', {
              method: 'POST',
              body: JSON.stringify({ ...buildPayload(), campaign_id: t.campaign_id, group_id: t.group_id }),
            }),
          ),
        );
        await Promise.allSettled(
          allGroupTargets.map((t) =>
            workerFetch('/naver/group-strategy/apply', {
              method: 'POST',
              body: JSON.stringify({
                site_id: siteId,
                campaign_id: t.campaign_id,
                group_id: t.group_id,
              }),
            }),
          ),
        );
      } else {
        await workerFetch('/naver/group-strategy', {
          method: 'POST',
          body: JSON.stringify(buildPayload()),
        });
        await workerFetch('/naver/group-strategy/apply', {
          method: 'POST',
          body: JSON.stringify({
            site_id: siteId,
            campaign_id: campaignId,
            group_id: groupId,
          }),
        });
      }
      onApplyToAll(keywordCount);
    } catch (e: any) {
      setError(e?.message ?? '적용 실패');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 mb-1">그룹 전략 설정</h3>
        <p className="text-xs text-gray-500 mb-5">{groupName} · 키워드 {keywordCount}개</p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">목표 순위</label>
              <select
                value={targetRank}
                onChange={(e) => setTargetRank(Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}위</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">매체</label>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value as Device)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">전체</option>
                <option value="PC">PC</option>
                <option value="M">모바일</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">최대 입찰가 (원)</label>
              <input
                type="number"
                value={maxBid}
                onChange={(e) => setMaxBid(Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">최소 입찰가 (원)</label>
              <input
                type="number"
                value={minBid}
                onChange={(e) => setMinBid(Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={lowestBid}
              onChange={(e) => setLowestBid(e.target.checked)}
              className="rounded border-gray-300"
            />
            최저가 입찰 사용
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">시간대 전략 (간단)</label>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { id: '', label: '미사용' },
                { id: 'peak', label: '피크타임 (9~18시)' },
                { id: 'night', label: '야간 중지' },
                { id: 'all3', label: '전시간 3위' },
              ] as { id: '' | 'peak' | 'night' | 'all3'; label: string }[]).map((p) => (
                <button
                  key={p.id || 'none'}
                  onClick={() => setHourlyPreset(p.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    hourlyPreset === p.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={handleApplyToAll}
            disabled={applying || saving || keywordCount === 0}
            className="w-full py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {applying && <Loader2 className="w-4 h-4 animate-spin" />}
            전체 키워드에 적용 ({keywordCount}개)
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || applying}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
