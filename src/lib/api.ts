const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;

export async function workerFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export interface NaverStatsResult {
  totals?: { impCnt: number; clkCnt: number; salesAmt: number; crto: number };
  daily?: { date: string; impCnt: number; clkCnt: number; salesAmt: number }[];
}

// siteId → campaign_ids 캐시 (세션 내 재사용)
const campaignIdsCache = new Map<string, { ids: string[]; at: number }>();
const CAMPAIGN_TTL = 5 * 60 * 1000;

export async function fetchCampaignIds(siteId: string): Promise<string[]> {
  const cached = campaignIdsCache.get(siteId);
  if (cached && Date.now() - cached.at < CAMPAIGN_TTL) return cached.ids;
  try {
    const data = await workerFetch<any>(`/naver/campaigns-groups?site_id=${siteId}`);
    const raw: any[] = Array.isArray(data) ? data : data?.data ?? data?.campaigns ?? [];
    const ids = raw
      .map((c: any) => c.campaign_id ?? c.nccCampaignId ?? c.campaignId ?? c.id)
      .filter((v: any): v is string => typeof v === 'string' && v.length > 0);
    campaignIdsCache.set(siteId, { ids, at: Date.now() });
    return ids;
  } catch {
    return [];
  }
}

// 캠페인 ID를 먼저 조회한 뒤 /naver/stats 를 호출한다.
// ids 가 비면 워커가 Naver API에서 통계를 가져올 수 없으므로 캠페인 조회가 선행되어야 한다.
export async function fetchNaverStats(
  siteId: string,
  timeRange: { since: string; until: string },
  opts?: { timeUnit?: 'day' | 'week' | 'month'; idType?: 'campaign' | 'adgroup' | 'keyword' },
): Promise<NaverStatsResult> {
  const ids = await fetchCampaignIds(siteId);
  if (ids.length === 0) return { totals: { impCnt: 0, clkCnt: 0, salesAmt: 0, crto: 0 }, daily: [] };
  return workerFetch<NaverStatsResult>('/naver/stats', {
    method: 'POST',
    body: JSON.stringify({
      site_id: siteId,
      ids,
      timeRange,
      fields: ['clkCnt', 'impCnt', 'salesAmt', 'crto'],
      idType: opts?.idType ?? 'campaign',
      timeUnit: opts?.timeUnit ?? 'day',
    }),
  });
}
