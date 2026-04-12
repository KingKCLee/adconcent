// adconcent-worker 에서 시간대별 방문 데이터 집계
const CLICK_TRACKER_URL = 'https://adconcent-worker.noble-kclee.workers.dev';

interface CTEvent { event: string; time: string }
interface CTIp {
  ip: string;
  count?: number;
  firstSeen?: string;
  lastSeen?: string;
  events?: CTEvent[];
}
interface CTStatsResponse { ips: CTIp[]; summary?: { total: number; totalClicks: number } }

export interface HourlyBucket {
  hour: number;       // 0~23
  visits: number;     // 방문 (visit 이벤트)
  clicks: number;     // 클릭 (click 이벤트)
  calls: number;      // 전화 (call 이벤트)
  uniqueIps: number;  // 해당 시간대 고유 IP
}

/**
 * click-tracker /stats 호출 → 지정 날짜의 0~23시 버킷 반환
 * @param target 'today' | 'yesterday' (KST 기준)
 */
export async function fetchHourlyVisits(target: 'today' | 'yesterday'): Promise<HourlyBucket[]> {
  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h, visits: 0, clicks: 0, calls: 0, uniqueIps: 0,
  }));
  const ipsByHour: Record<number, Set<string>> = {};
  for (let h = 0; h < 24; h++) ipsByHour[h] = new Set();

  // KST 기준 대상 날짜 (YYYY-MM-DD)
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  if (target === 'yesterday') kstNow.setUTCDate(kstNow.getUTCDate() - 1);
  const targetDay = kstNow.toISOString().slice(0, 10);

  try {
    const res = await fetch(`${CLICK_TRACKER_URL}/stats`, { cache: 'no-store' });
    if (!res.ok) return buckets;
    const json = (await res.json()) as CTStatsResponse;
    const ips = Array.isArray(json.ips) ? json.ips : [];

    for (const ipRow of ips) {
      const evs = ipRow.events || [];
      if (evs.length > 0) {
        for (const ev of evs) {
          if (!ev.time) continue;
          // ISO time → KST 변환
          const t = new Date(ev.time);
          if (isNaN(t.getTime())) continue;
          const kst = new Date(t.getTime() + 9 * 3600 * 1000);
          if (kst.toISOString().slice(0, 10) !== targetDay) continue;
          const hour = kst.getUTCHours();
          if (ev.event === 'visit') buckets[hour].visits++;
          else if (ev.event === 'click') buckets[hour].clicks++;
          else if (ev.event === 'call') buckets[hour].calls++;
          ipsByHour[hour].add(ipRow.ip);
        }
      } else if (ipRow.firstSeen) {
        // events 배열이 없는 옛 데이터 → firstSeen을 1회 visit로 계산
        const t = new Date(ipRow.firstSeen);
        if (!isNaN(t.getTime())) {
          const kst = new Date(t.getTime() + 9 * 3600 * 1000);
          if (kst.toISOString().slice(0, 10) === targetDay) {
            const hour = kst.getUTCHours();
            buckets[hour].visits += ipRow.count || 1;
            ipsByHour[hour].add(ipRow.ip);
          }
        }
      }
    }
    for (let h = 0; h < 24; h++) buckets[h].uniqueIps = ipsByHour[h].size;
  } catch { /* ignore */ }

  return buckets;
}
