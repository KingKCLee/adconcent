// ===== Simple in-memory cache =====
const CACHE: Record<string, { data: unknown; ts: number }> = {};

export function getCached<T>(key: string, ttlMs: number): T | null {
  const entry = CACHE[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) return null;
  return entry.data as T;
}

export function setCached(key: string, data: unknown) {
  CACHE[key] = { data, ts: Date.now() };
}

export function setCache(key: string, data: unknown) {
  CACHE[key] = { data, ts: Date.now() };
}

export function clearCache(key?: string) {
  if (key) delete CACHE[key];
  else Object.keys(CACHE).forEach((k) => delete CACHE[k]);
}

// ===== SWR cache (for naverApi) =====
const SWR_TTL: Record<string, number> = {
  campaigns: 5 * 60 * 1000,
  adgroups: 3 * 60 * 1000,
  keywords: 3 * 60 * 1000,
  stats: 10 * 60 * 1000,
  estimate: 10 * 60 * 1000,
};

function getTtl(key: string): number {
  const prefix = key.split('_')[0];
  return SWR_TTL[prefix] ?? 5 * 60 * 1000;
}

export async function swrCache<T>(
  accountId: string,
  key: string,
  fetcher: () => Promise<T>,
  onStale?: (fresh: T) => void
): Promise<T> {
  const cacheKey = `${accountId}:${key}`;
  const entry = CACHE[cacheKey];
  const ttl = getTtl(key);

  if (entry && Date.now() - entry.ts < ttl) {
    return entry.data as T;
  }

  if (entry && onStale) {
    fetcher().then(fresh => {
      CACHE[cacheKey] = { data: fresh, ts: Date.now() };
      onStale(fresh);
    }).catch(() => {});
    return entry.data as T;
  }

  const data = await fetcher();
  CACHE[cacheKey] = { data, ts: Date.now() };
  return data;
}

export function invalidateCache(accountId: string, key: string) {
  delete CACHE[`${accountId}:${key}`];
}

export interface SearchVolume {
  keyword: string;
  pc: number;
  mobile: number;
  total: number;
  updatedAt: string;
}

export async function getSearchVolume(keyword: string): Promise<SearchVolume | null> {
  const entry = CACHE[`sv:${keyword}`];
  if (entry && Date.now() - entry.ts < 86400000) return entry.data as SearchVolume;
  return null;
}

export async function setSearchVolume(keyword: string, pc: number, mobile: number): Promise<void> {
  CACHE[`sv:${keyword}`] = {
    data: { keyword, pc, mobile, total: pc + mobile, updatedAt: new Date().toISOString() },
    ts: Date.now(),
  };
}
