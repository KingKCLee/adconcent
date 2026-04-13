import { useSite } from '@/contexts/SiteContext';

export function usePlan() {
  const { plan, isLoading } = useSite();
  // 로딩 중에는 잠금 처리하지 않음 — 데이터 도착 후에만 free 판단
  const isFree = !isLoading && plan === 'free';
  return { plan, isLoading, isFree };
}
