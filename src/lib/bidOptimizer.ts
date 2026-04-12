// bid-optimizer.js와 동일한 로직을 TypeScript로 포팅

export const DEFAULT_GROUP_SETTINGS = {
  targetCpa: 30000,
  maxBid: 1000,
  minBid: 70,
};

export const DEFAULT_TARGET_RANKS: Record<string, number> = {
  'S등급_분양직접': 3,
  'A등급_관심비교': 5,
  'B등급_경쟁탐색': 7,
  '브랜드_방어': 1,
};

export const BID_LEVELS = [70, 100, 150, 200, 300, 400, 500, 600, 700, 800, 1000, 1200, 1500, 2000, 2500, 3000, 5000];

interface GroupSettings {
  targetCpa: number;
  maxBid: number;
  minBid: number;
}

interface BidResult {
  newBid: number;
  reason: string;
  currentBid: number;
  targetRank?: number;
  currentRank?: number;
}

interface AggStats {
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
}

// impressions 비율 기반으로 순위별 입찰가 계산 (server.js getEstimatedBids와 동일)
const RANK_THRESHOLDS: Record<number, number> = {
  1: 0.95, 3: 0.65, 5: 0.40, 7: 0.20, 10: 0.01,
};

export function estimateToRankBids(
  estimates: { bid: number; impressions: number }[]
): Record<number, number> {
  const maxImp = Math.max(...estimates.map(e => e.impressions || 0), 1);
  const rankBids: Record<number, number> = {};
  for (const [rank, threshold] of Object.entries(RANK_THRESHOLDS)) {
    for (const e of estimates) {
      const ratio = (e.impressions || 0) / maxImp;
      if (ratio >= threshold) {
        rankBids[Number(rank)] = e.bid;
        break;
      }
    }
  }
  return rankBids;
}

// 품질지수 반영 입찰가 계산
// 순위점수 = 입찰가 × 품질지수(QI)
// 경쟁사 QI는 4(보통)로 가정
export function adjustBidForQuality(baseBid: number, myQi: number, competitorQi: number = 4): number {
  if (myQi <= 0 || competitorQi <= 0) return baseBid;
  // 경쟁사 순위점수를 내 QI로 달성하려면
  const competitorScore = baseBid * competitorQi;
  return Math.ceil(competitorScore / myQi);
}

// 목표순위 기반 입찰가 계산 (품질지수 반영)
export function calculateBidByTargetRank(
  currentBid: number,
  currentRank: number,
  targetRank: number,
  rankBids: Record<number, number>,
  gs: GroupSettings,
  qiGrade?: number
): BidResult {
  const targetBid = rankBids[targetRank];

  if (!targetBid) {
    return { newBid: currentBid, reason: '순위데이터 없음(유지)', currentBid, targetRank, currentRank };
  }

  // QI가 있으면 품질지수 반영한 실제 필요 입찰가 계산
  let effectiveTargetBid = targetBid;
  let qiNote = '';
  if (qiGrade && qiGrade > 0 && qiGrade !== 4) {
    effectiveTargetBid = adjustBidForQuality(targetBid, qiGrade);
    qiNote = ` QI${qiGrade}`;
  }

  let newBid = currentBid;
  let reason = '유지';

  if (currentRank > targetRank) {
    newBid = Math.round(effectiveTargetBid * 1.05);
    newBid = Math.max(newBid, currentBid);
    const pct = currentBid > 0 ? Math.round((newBid - currentBid) / currentBid * 100) : 0;
    reason = `순위↑(${currentRank}위→${targetRank}위, +${pct}%${qiNote})`;
  } else if (currentRank < targetRank) {
    newBid = Math.round(effectiveTargetBid * 0.98);
    if (newBid >= currentBid) {
      newBid = Math.round(currentBid * 0.90);
    }
    const pct = currentBid > 0 ? Math.round((currentBid - newBid) / currentBid * 100) : 0;
    reason = `비용절감(${currentRank}위→${targetRank}위, -${pct}%${qiNote})`;
  } else {
    reason = `목표달성(${currentRank}위=${targetRank}위${qiNote})`;
    return { newBid: currentBid, reason, currentBid, targetRank, currentRank };
  }

  newBid = Math.round(newBid / 10) * 10;
  newBid = Math.min(newBid, gs.maxBid);
  newBid = Math.max(newBid, gs.minBid);

  return { newBid, reason, currentBid, targetRank, currentRank };
}

// CPA 기반 입찰가 계산 (bid-optimizer.js calculateOptimalBid 동일)
export function calculateOptimalBid(
  currentBid: number,
  stats: AggStats,
  gs: GroupSettings,
  qiGrade?: number
): BidResult {
  const { clicks, impressions, cost, conversions } = stats;
  const { targetCpa, maxBid, minBid } = gs;

  let newBid = currentBid;
  let reason = '유지';

  if (conversions > 0) {
    const actualCpa = cost / conversions;
    if (actualCpa > targetCpa * 1.3) {
      newBid = currentBid * 0.85;
      reason = `CPA초과(${Math.round(actualCpa).toLocaleString()}원, -15%)`;
    } else if (actualCpa > targetCpa * 1.1) {
      newBid = currentBid * 0.95;
      reason = `CPA높음(${Math.round(actualCpa).toLocaleString()}원, -5%)`;
    } else if (actualCpa < targetCpa * 0.7) {
      newBid = currentBid * 1.15;
      reason = `CPA우수(${Math.round(actualCpa).toLocaleString()}원, +15%)`;
    } else if (actualCpa < targetCpa * 0.9) {
      newBid = currentBid * 1.05;
      reason = `CPA양호(${Math.round(actualCpa).toLocaleString()}원, +5%)`;
    }
  } else if (clicks >= 10) {
    newBid = currentBid * 0.90;
    reason = `미전환(${clicks}클릭, -10%)`;
  } else if (impressions >= 50 && clicks === 0) {
    newBid = currentBid * 1.20;
    reason = `클릭부족(${impressions}노출, +20%)`;
  } else if (impressions >= 10 && impressions < 50 && clicks === 0) {
    newBid = currentBid * 1.10;
    reason = `노출소량(${impressions}노출, +10%)`;
  } else if (impressions < 10) {
    newBid = currentBid * 1.10;
    reason = `노출부족(${impressions}노출, +10%)`;
  }

  // QI 반영: 품질지수가 낮으면 입찰가 증가, 높으면 감소
  if (qiGrade !== undefined && qiGrade > 0) {
    const rawMultiplier = 4 / Math.max(qiGrade, 1);
    const bidMultiplier = Math.min(2.0, Math.max(0.5, rawMultiplier));
    newBid = newBid * bidMultiplier;
    if (bidMultiplier !== 1.0) {
      reason += ` QI${qiGrade}(x${bidMultiplier.toFixed(2)})`;
    }
  }

  newBid = Math.round(newBid / 10) * 10;
  newBid = Math.min(newBid, maxBid);
  newBid = Math.max(newBid, minBid);

  return { newBid, reason, currentBid };
}

// 시간대 배율 (bid-optimizer.js getTimeMultiplier 동일)
export const DEFAULT_TIME_SLOTS = [
  { name: '새벽', hours: [0, 1, 2, 3, 4, 5], days: 'all' as const, multiplier: 0.5 },
  { name: '출근', hours: [6, 7, 8], days: 'weekday' as const, multiplier: 0.9 },
  { name: '오전피크', hours: [9, 10, 11], days: 'weekday' as const, multiplier: 1.3 },
  { name: '점심', hours: [12, 13], days: 'all' as const, multiplier: 1.1 },
  { name: '오후', hours: [14, 15, 16, 17], days: 'weekday' as const, multiplier: 1.0 },
  { name: '퇴근', hours: [18], days: 'weekday' as const, multiplier: 1.1 },
  { name: '저녁피크', hours: [19, 20, 21, 22], days: 'all' as const, multiplier: 1.4 },
  { name: '야간', hours: [23], days: 'all' as const, multiplier: 0.7 },
  { name: '주말오전', hours: [9, 10, 11, 12], days: 'weekend' as const, multiplier: 1.0 },
  { name: '주말오후', hours: [13, 14, 15, 16, 17, 18], days: 'weekend' as const, multiplier: 0.8 },
];

export function getTimeMultiplier(now?: Date): { multiplier: number; slotName: string } {
  if (!now) now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let bestMatch = { multiplier: 1.0, slotName: '기본' };
  for (const slot of DEFAULT_TIME_SLOTS) {
    const hoursMatch = slot.hours.includes(hour);
    let daysMatch = false;
    if (slot.days === 'all') daysMatch = true;
    else if (slot.days === 'weekday' && !isWeekend) daysMatch = true;
    else if (slot.days === 'weekend' && isWeekend) daysMatch = true;

    if (hoursMatch && daysMatch) {
      if (slot.days !== 'all' || bestMatch.slotName === '기본') {
        bestMatch = { multiplier: slot.multiplier, slotName: slot.name };
      }
    }
  }
  return bestMatch;
}

// Stats 집계 (bid-optimizer.js aggregateStats 동일)
export function aggregateStats(dailyStats: { clkCnt?: number; impCnt?: number; salesAmt?: number; ccnt?: number; avgRnk?: number }[]): AggStats & { avgRank: number } {
  const agg = { clicks: 0, impressions: 0, cost: 0, conversions: 0 };
  const ranks: number[] = [];
  for (const day of dailyStats) {
    agg.clicks += day.clkCnt || 0;
    agg.impressions += day.impCnt || 0;
    agg.cost += day.salesAmt || 0;
    agg.conversions += day.ccnt || 0;
    if (day.avgRnk && day.avgRnk > 0) ranks.push(day.avgRnk);
  }
  const avgRank = ranks.length > 0 ? Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length) : 99;
  return { ...agg, avgRank };
}
