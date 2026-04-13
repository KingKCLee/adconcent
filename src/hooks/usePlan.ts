import { useEffect, useState } from 'react';
import type { PlanType } from '@/lib/plans';

const WORKER_URL = import.meta.env.VITE_ADCONCENT_WORKER_URL;

const VALID_PLANS: PlanType[] = ['free', 'starter', 'growth', 'pro'];

export function usePlan(siteId: string = 'hitbunyang') {
  const [plan, setPlan] = useState<PlanType>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`${WORKER_URL}/sites/${siteId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const p = (d?.data?.plan ?? d?.plan ?? '').toString().toLowerCase();
        if (VALID_PLANS.includes(p as PlanType)) {
          setPlan(p as PlanType);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  return { plan, isLoading, isFree: plan === 'free' };
}
