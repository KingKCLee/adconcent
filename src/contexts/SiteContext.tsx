import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { workerFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { PlanType } from '@/lib/plans';

export interface SiteInfo {
  site_id: string;
  domain: string;
  plan?: PlanType | string;
  naver_customer_id?: string | null;
  api_key?: string | null;
  secret_key?: string | null;
  script_installed?: number | boolean;
}

interface SiteContextValue {
  sites: SiteInfo[];
  siteId: string;
  siteDomain: string;
  selected: SiteInfo | null;
  plan: PlanType;
  isLoading: boolean;
  isError: boolean;
  setSiteId: (id: string) => void;
  refresh: () => Promise<void>;
}

const VALID_PLANS: PlanType[] = ['free', 'starter', 'growth', 'pro'];

const normalizePlan = (p: unknown): PlanType => {
  const v = String(p ?? '').toLowerCase();
  return (VALID_PLANS as string[]).includes(v) ? (v as PlanType) : 'free';
};

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [siteId, setSiteIdState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email ?? '';
      const qs = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
      const resp = await workerFetch<{ sites?: SiteInfo[] } | SiteInfo[]>(`/sites/list${qs}`);
      const list = Array.isArray(resp) ? resp : resp?.sites ?? [];
      setSites(list);
      const stored = typeof window !== 'undefined' ? localStorage.getItem('adconcent.siteId') : null;
      const initial = list.find((s) => s.site_id === stored)?.site_id ?? list[0]?.site_id ?? '';
      setSiteIdState(initial);
    } catch (e) {
      setSites([]);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setSiteId = (id: string) => {
    setSiteIdState(id);
    if (typeof window !== 'undefined') localStorage.setItem('adconcent.siteId', id);
  };

  const value = useMemo<SiteContextValue>(() => {
    const selected = sites.find((s) => s.site_id === siteId) ?? null;
    return {
      sites,
      siteId,
      siteDomain: selected?.domain ?? '',
      selected,
      plan: normalizePlan(selected?.plan),
      isLoading,
      isError,
      setSiteId,
      refresh: load,
    };
  }, [sites, siteId, isLoading, isError]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    return {
      sites: [],
      siteId: '',
      siteDomain: '',
      selected: null,
      plan: 'free',
      isLoading: false,
      isError: false,
      setSiteId: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
