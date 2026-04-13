import { useSite } from '@/contexts/SiteContext';

export function usePlan() {
  const { plan, isLoading } = useSite();
  return { plan, isLoading, isFree: plan === 'free' };
}
