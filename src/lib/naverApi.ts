import { supabase } from '@/lib/supabase';
import type { NaverCampaign, NaverAdGroup, NaverKeyword } from './types';
import { swrCache, invalidateCache, getSearchVolume, setSearchVolume } from './cache';

const SUPABASE_URL = 'https://srlkttykxpbmrusbavzi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybGt0dHlreHBibXJ1c2JhdnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTg0NzUsImV4cCI6MjA4ODc5NDQ3NX0.9NhCaHGGltXURdgNqnZqZk4LvzS8w8EMsYLbBYvY1KM';
const NAVER_PROXY_URL = `${SUPABASE_URL}/functions/v1/naver-proxy`;

interface NaverProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown> | Record<string, unknown>[];
  customerId?: string;
  apiKey?: string;
  secretKey?: string;
  statsParams?: {
    ids: string;
    fields: string[];
    timeUnit: string;
    since: string;
    until: string;
  };
}

async function callNaverProxy<T = unknown>(
  request: NaverProxyRequest
): Promise<{ data: T | null; error?: string }> {
  try {
    const response = await fetch(NAVER_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(request),
    });

    const json = await response.json();

    if (!response.ok) {
      return { data: null, error: json.error || `HTTP ${response.status}` };
    }

    return { data: json.data ?? json };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

// DB에서 키를 조회해서 요청에 포함
async function getAccountKeys(adAccountId: string): Promise<{
  customerId: string;
  apiKey: string;
  secretKey: string;
} | null> {
  const { data } = await supabase
    .from('ad_accounts')
    .select('naver_customer_id, naver_api_key_encrypted, naver_secret_key_encrypted')
    .eq('id', adAccountId)
    .single();

  if (!data?.naver_api_key_encrypted || !data?.naver_secret_key_encrypted) return null;

  return {
    customerId: data.naver_customer_id || '',
    apiKey: data.naver_api_key_encrypted,
    secretKey: data.naver_secret_key_encrypted,
  };
}

async function callWithAccountKeys<T = unknown>(
  adAccountId: string,
  method: string,
  path: string,
  body?: Record<string, unknown> | Record<string, unknown>[],
  statsParams?: NaverProxyRequest['statsParams']
): Promise<{ data: T | null; error?: string }> {
  const keys = await getAccountKeys(adAccountId);
  return callNaverProxy<T>({
    method: method as NaverProxyRequest['method'],
    path,
    body,
    customerId: keys?.customerId,
    apiKey: keys?.apiKey,
    secretKey: keys?.secretKey,
    statsParams,
  });
}

export async function fetchCampaigns(adAccountId: string): Promise<NaverCampaign[]> {
  const result = await callWithAccountKeys<NaverCampaign[]>(adAccountId, 'GET', '/ncc/campaigns');
  return result.data || [];
}

export async function fetchAdGroups(adAccountId: string, campaignId: string): Promise<NaverAdGroup[]> {
  const result = await callWithAccountKeys<NaverAdGroup[]>(adAccountId, 'GET', `/ncc/adgroups?nccCampaignId=${campaignId}`);
  return result.data || [];
}

export async function fetchKeywords(adAccountId: string, adGroupId: string): Promise<NaverKeyword[]> {
  const result = await callWithAccountKeys<NaverKeyword[]>(adAccountId, 'GET', `/ncc/keywords?nccAdgroupId=${adGroupId}`);
  return result.data || [];
}

export async function updateKeywordBid(adAccountId: string, keywordId: string, bidAmt: number, adGroupId?: string): Promise<boolean> {
  const result = await callWithAccountKeys(adAccountId, 'PUT', `/ncc/keywords/${keywordId}?fields=bidAmt`, {
    nccKeywordId: keywordId,
    nccAdgroupId: adGroupId,
    bidAmt,
    useGroupBidAmt: false,
  });
  return !result.error;
}

// 캠페인 ON/OFF
export async function toggleCampaign(
  adAccountId: string,
  campaignId: string,
  userLock: boolean
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/campaigns/${campaignId}?fields=userLock`, {
    nccCampaignId: campaignId,
    userLock,
  });
}

// 캠페인 일예산 수정
export async function updateCampaignBudget(
  adAccountId: string,
  campaignId: string,
  dailyBudget: number
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/campaigns/${campaignId}?fields=budget`, {
    nccCampaignId: campaignId,
    dailyBudget,
    useDailyBudget: dailyBudget > 0,
  });
}

// 광고그룹 ON/OFF
export async function toggleAdGroup(
  adAccountId: string,
  adGroupId: string,
  userLock: boolean
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}?fields=userLock`, {
    nccAdgroupId: adGroupId,
    userLock,
  });
}

// 광고그룹 일예산 수정
export async function updateAdGroupBudget(
  adAccountId: string,
  adGroupId: string,
  dailyBudget: number
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}?fields=budget`, {
    nccAdgroupId: adGroupId,
    dailyBudget,
  });
}

// 키워드 ON/OFF
export async function toggleKeyword(
  adAccountId: string,
  keywordId: string,
  userLock: boolean
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/keywords/${keywordId}?fields=userLock`, {
    nccKeywordId: keywordId,
    userLock,
  });
}

// 키워드 삭제
export async function deleteKeyword(
  adAccountId: string,
  keywordId: string
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'DELETE', `/ncc/keywords/${keywordId}`);
}

// 키워드 순위별 예상 입찰가 조회 (server.js와 동일: POST /estimate/performance/keyword)
export interface BidEstimate {
  bid: number;
  clicks: number;
  impressions: number;
  cost: number;
  position: number;
}

const BID_LEVELS = [70, 100, 150, 200, 300, 400, 500, 600, 700, 800, 1000, 1200, 1500, 2000, 2500, 3000, 5000];

export async function fetchBidEstimates(
  adAccountId: string,
  _keywordId: string,
  keyword?: string
): Promise<BidEstimate[]> {
  if (!keyword) return [];
  const result = await callWithAccountKeys<{ estimate: BidEstimate[] }>(
    adAccountId,
    'POST',
    '/estimate/performance/keyword',
    { device: 'PC', keywordplus: false, key: keyword, bids: BID_LEVELS }
  );
  if (result.data?.estimate) return result.data.estimate;
  if (Array.isArray(result.data)) return result.data as unknown as BidEstimate[];
  return [];
}

// 키워드 배치 입찰 추정 (여러 키워드 한번에)
export async function fetchKeywordBidEstimates(
  adAccountId: string,
  keywordIds: string[],
  keywordMap?: Record<string, string>
): Promise<Record<string, BidEstimate[]>> {
  const results: Record<string, BidEstimate[]> = {};
  // 5개씩 병렬 처리
  for (let i = 0; i < keywordIds.length; i += 5) {
    const batch = keywordIds.slice(i, i + 5);
    const promises = batch.map(async (kid) => {
      const kw = keywordMap?.[kid];
      const estimates = await fetchBidEstimates(adAccountId, kid, kw);
      return { kid, estimates };
    });
    const settled = await Promise.all(promises);
    for (const { kid, estimates } of settled) {
      results[kid] = estimates;
    }
  }
  return results;
}

// 네이버 IP 차단 등록 (server.js와 동일: filterIp 필드)
export async function registerIpExclusion(
  adAccountId: string,
  ipAddress: string
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/tool/ip-exclusions', {
    filterIp: ipAddress,
    memo: `자동차단_${new Date().toISOString().slice(0, 10)}`,
  });
}

// 네이버 IP 차단 해제
export async function removeIpExclusion(
  adAccountId: string,
  ipFilterId: string
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'DELETE', `/tool/ip-exclusions/${ipFilterId}`);
}

// 네이버 IP 차단 목록 조회
export async function fetchIpExclusions(
  adAccountId: string
): Promise<{ filterIp: string; ipFilterId: string; memo?: string }[]> {
  const result = await callWithAccountKeys<{ filterIp: string; ipFilterId: string; memo?: string }[]>(adAccountId, 'GET', '/tool/ip-exclusions');
  return Array.isArray(result.data) ? result.data : [];
}

// 소재(광고) 목록 조회
export async function fetchAds(adAccountId: string, adGroupId: string): Promise<any[]> {
  const result = await callWithAccountKeys<any[]>(adAccountId, 'GET', `/ncc/ads?nccAdgroupId=${adGroupId}`);
  return result.data || [];
}

// 소재 ON/OFF
export async function toggleAd(adAccountId: string, adId: string, userLock: boolean): Promise<boolean> {
  const result = await callWithAccountKeys(adAccountId, 'PUT', `/ncc/ads/${adId}?fields=userLock`, {
    nccAdId: adId,
    userLock,
  });
  return !result.error;
}

// 소재 삭제
export async function deleteAd(adAccountId: string, adId: string): Promise<boolean> {
  const result = await callWithAccountKeys(adAccountId, 'DELETE', `/ncc/ads/${adId}`);
  return !result.error;
}

// 소재 등록 (TEXT_45 타입)
export async function createAd(
  adAccountId: string,
  adGroupId: string,
  headline: string,
  description: string,
  pcUrl: string,
  mobileUrl: string
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/ads', {
    nccAdgroupId: adGroupId,
    type: 'TEXT_45',
    ad: { headline, description, pc: { final: pcUrl }, mobile: { final: mobileUrl } },
  });
}

// 확장소재 조회
export async function fetchAdExtensions(adAccountId: string, ownerId: string): Promise<unknown[]> {
  const result = await callWithAccountKeys<unknown[]>(adAccountId, 'GET', `/ncc/ad-extensions?ownerId=${ownerId}`);
  return Array.isArray(result.data) ? result.data : [];
}

// 확장소재 등록
export async function createAdExtension(
  adAccountId: string,
  ownerId: string,
  extType: string,
  extData: Record<string, unknown>
): Promise<{ data: unknown | null; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/ad-extensions', {
    ownerId,
    type: extType,
    ...extData,
  });
}

// 확장소재 삭제
export async function deleteAdExtension(adAccountId: string, extId: string): Promise<boolean> {
  const result = await callWithAccountKeys(adAccountId, 'DELETE', `/ncc/ad-extensions/${extId}`);
  return !result.error;
}

// 키워드별 Stats 조회 (server.js getKeywordStats 동일)
export interface KeywordStatRow {
  id: string;
  clkCnt: number;
  impCnt: number;
  salesAmt: number;
  ccnt: number;
  ctr: number;
  avgRnk: number;
}

export async function fetchKeywordStats(
  adAccountId: string,
  keywordIds: string[]
): Promise<KeywordStatRow[]> {
  const now = new Date();
  const until = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const allStats: KeywordStatRow[] = [];
  // 100개씩 분할 (server.js 동일)
  for (let i = 0; i < keywordIds.length; i += 100) {
    const batch = keywordIds.slice(i, i + 100);
    const result = await callWithAccountKeys<KeywordStatRow[]>(
      adAccountId, 'GET', '/stats', undefined, {
        ids: batch.join(','),
        fields: ['clkCnt', 'impCnt', 'salesAmt', 'ccnt', 'ctr', 'avgRnk'],
        timeUnit: 'day',
        since,
        until,
      }
    );
    if (Array.isArray(result.data)) {
      allStats.push(...result.data);
    }
  }
  return allStats;
}

// 네이버 Stats API - 성과 데이터 조회
export interface NaverStatRow {
  impCnt: number;
  clkCnt: number;
  salesAmt: number;
  ctr: number;
  cpc: number;
  ccnt: number;
  viewCnt?: number;
  statDt?: string;
  date?: string;
  time?: string;
}

export interface NaverStatsResponse {
  data: NaverStatRow[];
}

export async function fetchStats(
  adAccountId: string,
  campaignIds: string[],
  dateRange: { since: string; until: string },
  timeUnit: 'hour' | 'day' | 'month'
): Promise<NaverStatRow[]> {
  const statsParams = {
    ids: campaignIds.join(','),
    fields: ['impCnt', 'clkCnt', 'salesAmt', 'ctr', 'cpc', 'ccnt'],
    timeUnit,
    since: dateRange.since,
    until: dateRange.until,
  };

  // statsParams를 전달하면 Edge Function이 server.js와 동일 방식으로 URL 구성
  const result = await callWithAccountKeys<NaverStatRow[]>(
    adAccountId, 'GET', '/stats', undefined, statsParams
  );

  if (Array.isArray(result.data)) return result.data;
  return [];
}

// 전체 캠페인 합산 성과
// server.js /api/performance/chart 동일 방식:
// day 모드: 일별 개별 호출하여 날짜별 데이터 반환
// hour 모드: 한번 호출 (오늘/어제)
export async function fetchTotalStats(
  adAccountId: string,
  dateRange: { since: string; until: string },
  timeUnit: 'hour' | 'day' | 'month',
  targetCampaignId?: string
): Promise<NaverStatRow[]> {
  let ids: string[];

  if (targetCampaignId) {
    ids = [targetCampaignId];
  } else {
    const campaigns = await fetchCampaigns(adAccountId);
    if (campaigns.length === 0) return [];
    ids = campaigns.map(c => c.nccCampaignId);
  }

  // hour 모드 (오늘/어제): server.js와 동일하게 0~23시 슬롯 구성
  if (timeUnit === 'hour') {
    const raw = await fetchStats(adAccountId, ids, dateRange, 'hour');

    // 0~23시 슬롯 초기화
    const hourly: Record<string, { impCnt: number; clkCnt: number; salesAmt: number; ccnt: number; ctr: number; cpc: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourly[String(h).padStart(2, '0')] = { impCnt: 0, clkCnt: 0, salesAmt: 0, ccnt: 0, ctr: 0, cpc: 0 };
    }

    // 시간 정보 추출: hh, hour, statDt 순
    let hasHourData = false;
    for (const s of raw) {
      let h = -1;
      if ((s as any).hh != null) h = Number((s as any).hh);
      else if ((s as any).hour != null) h = Number((s as any).hour);
      else if (s.statDt && s.statDt.length > 10) h = new Date(s.statDt).getHours();
      if (h >= 0 && h < 24) {
        const key = String(h).padStart(2, '0');
        hourly[key].impCnt += s.impCnt || 0;
        hourly[key].clkCnt += s.clkCnt || 0;
        hourly[key].salesAmt += s.salesAmt || 0;
        hourly[key].ccnt += s.ccnt || 0;
        hasHourData = true;
      }
    }

    // 시간 정보 없으면 fallback: 합산을 현재 시간에 배치
    if (!hasHourData && raw.length > 0) {
      const curH = String(new Date().getHours()).padStart(2, '0');
      for (const s of raw) {
        hourly[curH].impCnt += s.impCnt || 0;
        hourly[curH].clkCnt += s.clkCnt || 0;
        hourly[curH].salesAmt += s.salesAmt || 0;
        hourly[curH].ccnt += s.ccnt || 0;
      }
    }

    // NaverStatRow[] 형태로 반환 (statDt = "HH" 형식으로 시간 표시)
    return Object.entries(hourly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hh, v]) => ({
        ...v,
        ctr: v.impCnt > 0 ? (v.clkCnt / v.impCnt) * 100 : 0,
        cpc: v.clkCnt > 0 ? Math.round(v.salesAmt / v.clkCnt) : 0,
        statDt: hh,
      }));
  }

  // day/month 모드: 일별 개별 호출 (server.js 동일)
  const dates: string[] = [];
  const d = new Date(dateRange.since);
  const endD = new Date(dateRange.until);
  while (d <= endD) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  // 5일씩 병렬 호출
  const allStats: NaverStatRow[] = [];
  for (let i = 0; i < dates.length; i += 5) {
    const batch = dates.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async (dt) => {
        const rows = await fetchStats(adAccountId, ids, { since: dt, until: dt }, 'day');
        // 각 row에 statDt 추가 (응답에 없으므로 직접 설정)
        let imp = 0, clk = 0, cost = 0, conv = 0, ctrSum = 0, cpcSum = 0;
        for (const r of rows) {
          imp += r.impCnt || 0; clk += r.clkCnt || 0;
          cost += r.salesAmt || 0; conv += r.ccnt || 0;
          ctrSum += r.ctr || 0; cpcSum += r.cpc || 0;
        }
        return {
          impCnt: imp, clkCnt: clk, salesAmt: cost, ccnt: conv,
          ctr: imp > 0 ? (clk / imp) * 100 : 0,
          cpc: clk > 0 ? Math.round(cost / clk) : 0,
          statDt: dt,
        } as NaverStatRow;
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.impCnt + r.value.clkCnt + r.value.salesAmt > 0) {
        allStats.push(r.value);
      }
    }
  }
  return allStats;
}

export async function fetchBizMoney(adAccountId: string): Promise<number> {
  const result = await callWithAccountKeys<{ bizmoney: number }>(adAccountId, 'GET', '/billing/bizmoney');
  return result.data?.bizmoney ?? 0;
}

// 연결 테스트: 입력값을 직접 전달 (DB 거치지 않음)
export async function testConnectionDirect(
  customerId: string,
  apiKey: string,
  secretKey: string
): Promise<{ success: boolean; message: string }> {
  const result = await callNaverProxy<NaverCampaign[]>({
    method: 'GET',
    path: '/ncc/campaigns',
    customerId,
    apiKey,
    secretKey,
  });
  if (result.error) {
    return { success: false, message: result.error };
  }
  const campaigns = Array.isArray(result.data) ? result.data : [];
  return { success: true, message: `연결 성공! 캠페인 ${campaigns.length}개 확인` };
}

// 연관 키워드 조회 (GET /keywordstool)
export interface RelatedKeyword {
  relKeyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  compIdx: string;
  monthlyAvePcClkCnt: number;
  monthlyAveMobileClkCnt: number;
  monthlyAvePcCtr: number;
  monthlyAveMobileCtr: number;
  plAvgDepth: number;
}

export async function getRelatedKeywords(
  adAccountId: string,
  keywords: string[]
): Promise<RelatedKeyword[]> {
  const encoded = encodeURIComponent(keywords.join(','));
  const result = await callWithAccountKeys<{ keywordList: RelatedKeyword[] }>(
    adAccountId, 'GET', `/keywordstool?hintKeywords=${encoded}&showDetail=1`
  );
  return result.data?.keywordList || [];
}

// 키워드 등록 (POST /ncc/keywords)
export async function addKeywords(
  adAccountId: string,
  adGroupId: string,
  keywords: { keyword: string; bidAmt: number }[]
): Promise<{ data: unknown | null; error?: string }> {
  const body = keywords.map(kw => ({
    nccAdgroupId: adGroupId,
    keyword: kw.keyword,
    bidAmt: kw.bidAmt,
    useGroupBidAmt: false,
  }));
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/keywords', body as unknown as Record<string, unknown>[]);
}

// ============================================
// 캠페인/광고그룹 create/delete + 고급 설정
// ============================================

export async function createCampaign(
  adAccountId: string,
  body: { name: string; campaignTp: string; dailyBudget: number; deliveryMethod?: string }
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/campaigns', {
    name: body.name,
    campaignTp: body.campaignTp,
    dailyBudget: body.dailyBudget,
    useDailyBudget: body.dailyBudget > 0,
    deliveryMethod: body.deliveryMethod || 'STANDARD',
  });
}

export async function deleteCampaign(
  adAccountId: string,
  campaignId: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'DELETE', `/ncc/campaigns/${campaignId}`);
}

export async function updateCampaignPeriod(
  adAccountId: string,
  campaignId: string,
  usePeriod: boolean,
  startDt?: string,
  endDt?: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/campaigns/${campaignId}?fields=period`, {
    nccCampaignId: campaignId,
    usePeriod,
    periodStartDt: startDt,
    periodEndDt: endDt,
  });
}

export async function updateCampaignDelivery(
  adAccountId: string,
  campaignId: string,
  deliveryMethod: 'ACCELERATED' | 'STANDARD'
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/campaigns/${campaignId}?fields=deliveryMethod`, {
    nccCampaignId: campaignId,
    deliveryMethod,
  });
}

export async function createAdGroup(
  adAccountId: string,
  body: { nccCampaignId: string; name: string; bidAmt: number; mobileChannelId: string; pcChannelId: string }
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/adgroups', {
    nccCampaignId: body.nccCampaignId,
    name: body.name,
    bidAmt: body.bidAmt,
    mobileChannelId: body.mobileChannelId,
    pcChannelId: body.pcChannelId,
  });
}

export async function deleteAdGroup(
  adAccountId: string,
  adGroupId: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'DELETE', `/ncc/adgroups/${adGroupId}`);
}

export async function updateAdGroupBidWeights(
  adAccountId: string,
  adGroupId: string,
  pcWeight: number,
  mobileWeight: number
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}?fields=bidAmt`, {
    nccAdgroupId: adGroupId,
    pcNetworkBidWeight: pcWeight,
    mobileNetworkBidWeight: mobileWeight,
  });
}

export async function updateAdGroupContentsBid(
  adAccountId: string,
  adGroupId: string,
  useContents: boolean,
  contentsBidAmt: number
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}?fields=bidAmt`, {
    nccAdgroupId: adGroupId,
    useCntsNetworkBidAmt: useContents,
    contentsNetworkBidAmt: contentsBidAmt,
  });
}

export async function updateAdGroupExpSearch(
  adAccountId: string,
  adGroupId: string,
  useExpSearch: boolean,
  ratio?: number
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}?fields=expSearch`, {
    nccAdgroupId: adGroupId,
    useExpSearch,
    expSearchBudgetRatio: ratio,
  });
}

export async function updateAdGroupRollingType(
  adAccountId: string,
  adGroupId: string,
  type: 'PERFORMANCE' | 'ROTATION'
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}?fields=adRollingType`, {
    nccAdgroupId: adGroupId,
    adRollingType: type,
  });
}

export async function updateAdGroupTrackingUrl(
  adAccountId: string,
  adGroupId: string,
  trackingUrl: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}?fields=trackingUrl`, {
    nccAdgroupId: adGroupId,
    trackingUrl,
  });
}

export async function bulkCreateKeywords(
  adAccountId: string,
  adGroupId: string,
  keywords: { keyword: string; bidAmt: number }[]
): Promise<{ data: unknown; error?: string }> {
  const body = keywords.map(kw => ({
    nccAdgroupId: adGroupId,
    keyword: kw.keyword,
    bidAmt: kw.bidAmt,
    useGroupBidAmt: false,
  }));
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/keywords', body as unknown as Record<string, unknown>[]);
}

// ============================================
// 공유예산
// ============================================

export async function fetchSharedBudgets(adAccountId: string): Promise<unknown[]> {
  const result = await callWithAccountKeys<unknown[]>(adAccountId, 'GET', '/ncc/shared-budgets');
  return Array.isArray(result.data) ? result.data : [];
}

export async function createSharedBudget(
  adAccountId: string,
  body: { name: string; dailyBudget: number; deliveryMethod?: string }
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/shared-budgets', {
    name: body.name,
    dailyBudget: body.dailyBudget,
    deliveryMethod: body.deliveryMethod || 'STANDARD',
  });
}

export async function linkCampaignToSharedBudget(
  adAccountId: string,
  campaignId: string,
  sharedBudgetId: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/campaigns/${campaignId}?fields=sharedBudget`, {
    nccCampaignId: campaignId,
    sharedBudgetId,
  });
}

// ============================================
// 타겟팅 / 변경이력 / 비즈채널 / 전환추적
// ============================================

export interface NaverTarget {
  nccTargetId?: string;
  nccAdgroupId?: string;
  targetTp: string;
  target: Record<string, unknown>;
}

export async function fetchTargets(adAccountId: string, adGroupId: string): Promise<NaverTarget[]> {
  const result = await callWithAccountKeys<NaverTarget[]>(adAccountId, 'GET', `/ncc/adgroups/${adGroupId}/targets`);
  return Array.isArray(result.data) ? result.data : [];
}

export async function updateTarget(
  adAccountId: string, adGroupId: string, targetTp: string, target: Record<string, unknown>
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}/targets`, {
    nccAdgroupId: adGroupId, targetTp, target,
  });
}

export async function fetchBizMoneyHistories(
  adAccountId: string, startDate: string, endDate: string
): Promise<unknown[]> {
  const result = await callWithAccountKeys<unknown[]>(adAccountId, 'GET', `/billing/bizmoney/histories?startDate=${startDate}&endDate=${endDate}`);
  return Array.isArray(result.data) ? result.data : [];
}

// 노출 제한 키워드
export interface RestrictedKeyword {
  nccAdgroupId?: string;
  keyword: string;
  type: number;
  id?: string;
}

export async function fetchRestrictedKeywords(adAccountId: string, adGroupId: string): Promise<RestrictedKeyword[]> {
  const result = await callWithAccountKeys<RestrictedKeyword[]>(adAccountId, 'GET', `/ncc/adgroups/${adGroupId}/restricted-keywords`);
  return Array.isArray(result.data) ? result.data : [];
}

export async function addRestrictedKeywords(
  adAccountId: string, adGroupId: string, keywords: { keyword: string; type: number }[]
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', `/ncc/adgroups/${adGroupId}/restricted-keywords`,
    keywords as unknown as Record<string, unknown>[]);
}

export async function deleteRestrictedKeyword(
  adAccountId: string, adGroupId: string, keyword: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'DELETE', `/ncc/adgroups/${adGroupId}/restricted-keywords?keyword=${encodeURIComponent(keyword)}`);
}

export interface NaverChannel {
  nccBusinessChannelId: string;
  channelTp: string;
  name: string;
  channelKey: string;
  pcInspectStatus: string;
  mobileInspectStatus: string;
  status: string;
  statusReason?: string;
}

// DB 키 기반 연결 테스트
export async function testConnection(adAccountId: string): Promise<{ success: boolean; message: string }> {
  const result = await callWithAccountKeys<NaverCampaign[]>(adAccountId, 'GET', '/ncc/campaigns');
  if (result.error) {
    return { success: false, message: result.error };
  }
  const campaigns = Array.isArray(result.data) ? result.data : [];
  return { success: true, message: `연결 성공! 캠페인 ${campaigns.length}개 확인` };
}

// ===== 캐시된 wrapper 함수들 (기존 함수 보존) =====

export async function fetchCampaignsCached(adAccountId: string, onUpdate?: (data: NaverCampaign[]) => void): Promise<NaverCampaign[]> {
  return swrCache(adAccountId, 'campaigns', () => fetchCampaigns(adAccountId), onUpdate);
}

export async function fetchAdGroupsCached(adAccountId: string, campaignId: string, onUpdate?: (data: NaverAdGroup[]) => void): Promise<NaverAdGroup[]> {
  return swrCache(adAccountId, `adgroups_${campaignId}`, () => fetchAdGroups(adAccountId, campaignId), onUpdate);
}

export async function fetchKeywordsCached(adAccountId: string, adGroupId: string, onUpdate?: (data: NaverKeyword[]) => void): Promise<NaverKeyword[]> {
  return swrCache(adAccountId, `keywords_${adGroupId}`, () => fetchKeywords(adAccountId, adGroupId), onUpdate);
}

export async function fetchAdsCached(adAccountId: string, adGroupId: string, onUpdate?: (data: unknown[]) => void): Promise<unknown[]> {
  return swrCache(adAccountId, `ads_${adGroupId}`, () => fetchAds(adAccountId, adGroupId), onUpdate);
}

export async function fetchIpExclusionsCached(adAccountId: string, onUpdate?: (data: unknown[]) => void): Promise<unknown[]> {
  return swrCache(adAccountId, 'iplist', () => fetchIpExclusions(adAccountId), onUpdate);
}

// 캐시 무효화 (강제 새로고침용)
export async function invalidateCampaignsCache(adAccountId: string): Promise<void> {
  return invalidateCache(adAccountId, 'campaigns');
}
export async function invalidateAdGroupsCache(adAccountId: string, campaignId: string): Promise<void> {
  return invalidateCache(adAccountId, `adgroups_${campaignId}`);
}
export async function invalidateKeywordsCache(adAccountId: string, adGroupId: string): Promise<void> {
  return invalidateCache(adAccountId, `keywords_${adGroupId}`);
}
export async function invalidateAdsCache(adAccountId: string, adGroupId: string): Promise<void> {
  return invalidateCache(adAccountId, `ads_${adGroupId}`);
}
export async function invalidateIpListCache(adAccountId: string): Promise<void> {
  return invalidateCache(adAccountId, 'iplist');
}

interface SearchVolumeData {
  monthly_pc: number;
  monthly_mobile: number;
  monthly_total: number;
  daily_avg: number;
}

// 키워드 검색량 (24시간 캐시)
export async function fetchSearchVolumeCached(adAccountId: string, keywords: string[]): Promise<Record<string, SearchVolumeData>> {
  const results: Record<string, SearchVolumeData> = {};
  const toFetch: string[] = [];
  for (const kw of keywords) {
    const cached = await getSearchVolume(kw);
    if (cached) results[kw] = { monthly_pc: cached.pc, monthly_mobile: cached.mobile, monthly_total: cached.total, daily_avg: Math.round(cached.total / 30) };
    else toFetch.push(kw);
  }
  // 5개씩 병렬 조회
  for (let i = 0; i < toFetch.length; i += 5) {
    const batch = toFetch.slice(i, i + 5);
    await Promise.all(batch.map(async (kw) => {
      try {
        const result = await callWithAccountKeys<{ keywordList: any[] }>(
          adAccountId, 'GET', `/keywordstool?hintKeywords=${encodeURIComponent(kw)}&showDetail=1`,
        );
        const item = (result.data?.keywordList || []).find((k: any) => k.relKeyword === kw);
        if (item) {
          const pc = item.monthlyPcQcCnt === '< 10' ? 5 : (Number(item.monthlyPcQcCnt) || 0);
          const mobile = item.monthlyMobileQcCnt === '< 10' ? 5 : (Number(item.monthlyMobileQcCnt) || 0);
          await setSearchVolume(kw, pc, mobile);
          results[kw] = { monthly_pc: pc, monthly_mobile: mobile, monthly_total: pc + mobile, daily_avg: Math.round((pc + mobile) / 30) };
        }
      } catch { /* skip */ }
    }));
  }
  return results;
}

// ============================================================================
// 확장 API — 노출 진단, 타겟팅, 변경이력, 비즈채널, 전환추적, 마스터 리포트 등
// ============================================================================

// ===== 노출 진단 =====
export async function fetchKeywordExposureStatus(
  adAccountId: string,
  keywordId: string
): Promise<{ isExposed?: boolean; notExposedReason?: string } | null> {
  const result = await callWithAccountKeys<{ isExposed?: boolean; notExposedReason?: string }>(
    adAccountId, 'GET', `/ncc/keywords/${keywordId}/status`
  );
  return result.data || null;
}

// ===== 타겟팅 =====
export async function fetchAdGroupTargets(
  adAccountId: string,
  adGroupId: string
): Promise<unknown[]> {
  const result = await callWithAccountKeys<unknown[]>(
    adAccountId, 'GET', `/ncc/adgroups/${adGroupId}/targets`
  );
  return Array.isArray(result.data) ? result.data : [];
}

// Naver NCC: POST /ncc/adgroups/{id}/targets 는 배열 body 필수
export async function createAdGroupTarget(
  adAccountId: string,
  adGroupId: string,
  body: Record<string, unknown> | Record<string, unknown>[]
): Promise<{ data: unknown; error?: string }> {
  const arrBody = Array.isArray(body) ? body : [body];
  return callWithAccountKeys(adAccountId, 'POST', `/ncc/adgroups/${adGroupId}/targets`, arrBody);
}

export async function updateAdGroupTarget(
  adAccountId: string,
  adGroupId: string,
  targetId: string,
  body: Record<string, unknown>
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(
    adAccountId, 'PUT', `/ncc/adgroups/${adGroupId}/targets/${targetId}`, body
  );
}

export async function deleteAdGroupTarget(
  adAccountId: string,
  adGroupId: string,
  targetId: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(
    adAccountId, 'DELETE', `/ncc/adgroups/${adGroupId}/targets/${targetId}`
  );
}

// ===== 노출 제한 키워드 (이전 블록에 정의됨) =====
export async function deleteRestrictedKeywordsByIds(
  adAccountId: string,
  adGroupId: string,
  ids: string[]
): Promise<{ data: unknown; error?: string }> {
  const idsParam = ids.join(',');
  return callWithAccountKeys(
    adAccountId, 'DELETE',
    `/ncc/adgroups/${adGroupId}/restricted-keywords?ids=${encodeURIComponent(idsParam)}`
  );
}

// ===== 변경이력 =====
export async function fetchChangeLogs(
  adAccountId: string,
  params: { startDate?: string; endDate?: string; campaignId?: string }
): Promise<unknown[]> {
  const qs: string[] = [];
  if (params.startDate) qs.push(`startDate=${params.startDate}`);
  if (params.endDate) qs.push(`endDate=${params.endDate}`);
  if (params.campaignId) qs.push(`campaignId=${params.campaignId}`);
  const path = `/ncc/change-logs${qs.length ? '?' + qs.join('&') : ''}`;
  const result = await callWithAccountKeys<unknown[] | { changeLogs?: unknown[] }>(
    adAccountId, 'GET', path
  );
  if (Array.isArray(result.data)) return result.data;
  const d = result.data as { changeLogs?: unknown[] } | null;
  return d?.changeLogs || [];
}

// ===== 전환추적 =====
export async function fetchConversionTrackings(adAccountId: string): Promise<unknown[]> {
  const result = await callWithAccountKeys<unknown[]>(
    adAccountId, 'GET', '/ncc/conversion-trackings'
  );
  return Array.isArray(result.data) ? result.data : [];
}

export async function createConversionTracking(
  adAccountId: string,
  body: Record<string, unknown>
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/conversion-trackings', body);
}

export async function deleteConversionTracking(
  adAccountId: string,
  trackingId: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(
    adAccountId, 'DELETE', `/ncc/conversion-trackings/${trackingId}`
  );
}

// ===== 비즈머니 내역 =====
export async function fetchBizMoneyHistory(adAccountId: string): Promise<unknown[]> {
  const result = await callWithAccountKeys<unknown[] | { histories?: unknown[] }>(
    adAccountId, 'GET', '/billing/bizmoney/histories'
  );
  if (Array.isArray(result.data)) return result.data;
  const d = result.data as { histories?: unknown[] } | null;
  return d?.histories || [];
}

// ===== 고객 정보 =====
export async function fetchCustomerInfo(adAccountId: string): Promise<unknown | null> {
  const keys = await getAccountKeys(adAccountId);
  if (!keys?.customerId) return null;
  const result = await callWithAccountKeys(
    adAccountId, 'GET', `/customers/${keys.customerId}`
  );
  return result.data || null;
}

// ===== 비즈채널 =====
export async function fetchChannels(adAccountId: string): Promise<unknown[]> {
  const result = await callWithAccountKeys<unknown[]>(
    adAccountId, 'GET', '/ncc/channels'
  );
  return Array.isArray(result.data) ? result.data : [];
}

export async function createChannel(
  adAccountId: string,
  body: Record<string, unknown>
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/ncc/channels', body);
}

export async function deleteChannel(
  adAccountId: string,
  channelId: string
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'DELETE', `/ncc/channels/${channelId}`);
}

// ===== 마스터 리포트 =====
export async function createMasterReport(
  adAccountId: string,
  body: { reportTp: string; statDt: string }
): Promise<{ data: unknown; error?: string }> {
  return callWithAccountKeys(adAccountId, 'POST', '/master-reports', body as unknown as Record<string, unknown>);
}

export async function fetchMasterReports(adAccountId: string): Promise<unknown[]> {
  const result = await callWithAccountKeys<unknown[]>(
    adAccountId, 'GET', '/master-reports'
  );
  return Array.isArray(result.data) ? result.data : [];
}

// ===== 키워드 도구 (확장) =====
export async function fetchKeywordTool(
  adAccountId: string,
  hintKeywords: string[]
): Promise<{ keywordList: unknown[] }> {
  const hint = encodeURIComponent(hintKeywords.join(','));
  const result = await callWithAccountKeys<{ keywordList: unknown[] }>(
    adAccountId, 'GET', `/keywordstool?hintKeywords=${hint}&showDetail=1`
  );
  const kl = result.data?.keywordList;
  return { keywordList: Array.isArray(kl) ? kl : [] };
}
