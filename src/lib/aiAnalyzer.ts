// AI 분석 엔진 — Claude API 우선, 실패 시 규칙형 fallback
// 유저가 몰라도 히트AD가 자동으로 분석/추천/경고

import { aiBriefing, aiKeywordHealth, aiAdSuggestions, aiWeeklyInsight, aiDiagnose } from './claudeApi';

export interface AiBriefing {
  summary: string;
  details: string[];
  actions: { text: string; level: 'urgent' | 'warn' | 'info'; tab?: string }[];
}

export interface KeywordHealth {
  icon: string;
  message: string;
  color: string;
  action?: string;
}

export interface CampaignHealth {
  score: number;
  label: string;
  color: string;
  reasons: string[];
}

// Claude AI 브리핑 (비동기 — 호출 측에서 .then()으로 업데이트)
export async function generateBriefingAI(
  totals: { imp: number; clk: number; cost: number; conv: number },
  bizMoney: number,
  targetCpa: number,
  dailyBudget: number,
  keywordCount?: number,
): Promise<AiBriefing | null> {
  const result = await aiBriefing({ totals, bizMoney, targetCpa, dailyBudget, keywords: keywordCount });
  if (!result) return null;
  return result as AiBriefing;
}

// Claude AI 키워드 건강도
export async function analyzeKeywordHealthAI(
  keyword: string, bidAmt: number, qiGrade: number,
  rank1Bid: number, rank3Bid: number, status: string,
  impressions?: number, clicks?: number,
): Promise<KeywordHealth | null> {
  return aiKeywordHealth({ keyword, bidAmt, qiGrade, rank1Bid, rank3Bid, status, impressions, clicks });
}

// Claude AI 소재 추천
export async function generateAdSuggestionsAI(
  productName: string, region: string, keywords?: string[], currentAds?: unknown[],
): Promise<{ headlines: string[]; descriptions: string[]; reasoning: string } | null> {
  return aiAdSuggestions({ productName, region, keywords, currentAds });
}

// Claude AI 주간 인사이트
export async function generateWeeklyInsightAI(
  thisWeek: { imp: number; clk: number; cost: number; conv: number },
  lastWeek: { imp: number; clk: number; cost: number; conv: number },
  dailyBudget: number, keywords?: number,
): Promise<{ good: string[]; improve: string[]; recommend: string[] } | null> {
  return aiWeeklyInsight({ thisWeek, lastWeek, dailyBudget, keywords });
}

// Claude AI 노출 진단
export async function diagnoseKeywordAI(
  params: Parameters<typeof aiDiagnose>[0]
): Promise<DiagnosisResult | null> {
  const result = await aiDiagnose(params);
  if (!result) return null;
  return { keyword: params.keyword, ...result } as DiagnosisResult;
}

// ─── 규칙형 Fallback (Claude 미연결 시 사용) ───

// 대시보드 AI 브리핑 생성 (규칙형)
export function generateBriefing(
  totals: { imp: number; clk: number; cost: number; conv: number },
  prevTotals: { imp: number; clk: number; cost: number; conv: number } | null,
  bizMoney: number,
  targetCpa: number,
  dailyBudget: number,
): AiBriefing {
  const ctr = totals.imp > 0 ? (totals.clk / totals.imp) * 100 : 0;
  const cpa = totals.conv > 0 ? Math.round(totals.cost / totals.conv) : 0;
  const details: string[] = [];
  const actions: AiBriefing['actions'] = [];

  // 전일 대비
  if (prevTotals) {
    const clkDiff = totals.clk - prevTotals.clk;
    const costDiff = totals.cost - prevTotals.cost;
    if (clkDiff !== 0 || costDiff !== 0) {
      details.push(`어제 대비 클릭 ${clkDiff >= 0 ? '+' : ''}${clkDiff}회, 광고비 ${costDiff >= 0 ? '+' : ''}${costDiff.toLocaleString()}원`);
    }
  }

  // 긴급
  if (bizMoney > 0 && bizMoney < 50000) {
    actions.push({ text: `비즈머니 ${Math.floor(bizMoney).toLocaleString()}원 — 곧 광고 중단`, level: 'urgent' });
  }
  if (cpa > 0 && cpa > targetCpa * 1.5) {
    actions.push({ text: `CPA ${cpa.toLocaleString()}원 — 목표 대비 ${Math.round(cpa / targetCpa * 100)}%`, level: 'urgent', tab: 'automation' });
  }

  // 권고
  if (dailyBudget > 0 && totals.cost > 0 && totals.cost < dailyBudget * 0.2) {
    actions.push({ text: '오늘 광고비가 일예산의 20% 미만 — 입찰가 또는 순위 확인', level: 'warn', tab: 'keywords' });
  }
  if (ctr > 0 && ctr < 0.5) {
    actions.push({ text: `CTR ${ctr.toFixed(2)}% — 업종 평균(1.2%) 대비 매우 낮음`, level: 'warn', tab: 'ads' });
  }
  if (ctr > 0 && ctr < 1.0 && ctr >= 0.5) {
    details.push(`CTR ${ctr.toFixed(2)}% — 업종 평균(1.2%) 대비 약간 낮음. 소재 개선 검토`);
  }

  // 정보
  if (cpa > 0 && cpa <= targetCpa * 0.7) {
    actions.push({ text: 'CPA 우수 달성 중! 노출 확대 가능', level: 'info', tab: 'automation' });
  }
  if (totals.conv > 0) {
    details.push(`전환 ${totals.conv}건 발생 (CPA ${cpa.toLocaleString()}원)`);
  }

  const summary = actions.length > 0
    ? `${actions.filter(a => a.level === 'urgent').length}건 긴급, ${actions.filter(a => a.level === 'warn').length}건 권고`
    : '정상 운영 중';

  return { summary, details, actions };
}

// 키워드 건강도 분석
export function analyzeKeywordHealth(
  keyword: string,
  bidAmt: number,
  rank1Bid: number,
  rank3Bid: number,
  status: string,
): KeywordHealth {
  if (status !== 'ELIGIBLE') {
    return { icon: '😴', message: '광고 중지 상태', color: 'text-gray-400' };
  }
  if (rank3Bid > 0 && bidAmt >= rank1Bid && rank1Bid > 0) {
    const savings = bidAmt - rank3Bid;
    return { icon: '💡', message: `비용 절감 가능 — 3위로 낮추면 ${savings.toLocaleString()}원 절약`, color: 'text-blue-500', action: 'lower' };
  }
  if (rank3Bid > 0 && bidAmt >= rank3Bid) {
    return { icon: '✅', message: `목표순위 달성 중 (CPC ${bidAmt.toLocaleString()}원)`, color: 'text-green-600' };
  }
  if (rank3Bid > 0 && bidAmt < rank3Bid) {
    const diff = rank3Bid - bidAmt;
    return { icon: '⚠️', message: `3위 달성하려면 ${diff.toLocaleString()}원 인상 필요`, color: 'text-red-500', action: 'raise' };
  }
  return { icon: '📊', message: '경쟁 입찰가 조회 중...', color: 'text-muted-foreground' };
}

// 캠페인 건강도 점수 (0~100)
export function calculateCampaignHealth(
  campaignStatus: string,
  totalKeywords: number,
  activeKeywords: number,
  avgCtr: number,
  avgCpa: number,
  targetCpa: number,
): CampaignHealth {
  if (campaignStatus !== 'ELIGIBLE') {
    return { score: 0, label: '중지', color: 'text-gray-400', reasons: ['캠페인 일시중지 상태'] };
  }

  let score = 50; // 기본점수
  const reasons: string[] = [];

  // CTR 점수 (0~25)
  if (avgCtr >= 2.0) { score += 25; }
  else if (avgCtr >= 1.0) { score += 15; }
  else if (avgCtr >= 0.5) { score += 5; reasons.push('CTR이 업종 평균 이하'); }
  else { reasons.push('CTR이 매우 낮음 — 소재 개선 필요'); }

  // CPA 점수 (0~25)
  if (avgCpa > 0 && targetCpa > 0) {
    if (avgCpa <= targetCpa * 0.7) { score += 25; }
    else if (avgCpa <= targetCpa) { score += 15; }
    else if (avgCpa <= targetCpa * 1.3) { score += 5; reasons.push('CPA가 목표에 근접'); }
    else { reasons.push('CPA 목표 초과 — 입찰가 조정 필요'); }
  }

  // 키워드 활성률
  const activeRate = totalKeywords > 0 ? activeKeywords / totalKeywords : 0;
  if (activeRate < 0.5) { score -= 10; reasons.push('절반 이상의 키워드가 비활성'); }

  score = Math.max(0, Math.min(100, score));
  const label = score >= 90 ? '최적' : score >= 60 ? '개선 필요' : '즉시 조치';
  const color = score >= 90 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';

  return { score, label, color, reasons };
}

// 주간 리포트 인사이트 생성
export function generateWeeklyInsight(
  thisWeek: { imp: number; clk: number; cost: number; conv: number },
  lastWeek: { imp: number; clk: number; cost: number; conv: number },
  dailyBudget: number,
): { good: string[]; improve: string[]; recommend: string[] } {
  const good: string[] = [];
  const improve: string[] = [];
  const recommend: string[] = [];

  const thisCtr = thisWeek.imp > 0 ? (thisWeek.clk / thisWeek.imp) * 100 : 0;
  const lastCtr = lastWeek.imp > 0 ? (lastWeek.clk / lastWeek.imp) * 100 : 0;

  if (thisCtr > lastCtr && lastCtr > 0) good.push(`CTR ${thisCtr.toFixed(2)}% (지난주 ${lastCtr.toFixed(2)}% 대비 개선)`);
  else if (thisCtr < lastCtr && lastCtr > 0) improve.push(`CTR ${thisCtr.toFixed(2)}%로 하락 (지난주 ${lastCtr.toFixed(2)}%) — 소재 개선 검토`);

  if (thisWeek.conv > lastWeek.conv) good.push(`전환 ${thisWeek.conv}건 (지난주 ${lastWeek.conv}건 대비 증가)`);
  if (thisWeek.cost < lastWeek.cost && thisWeek.clk >= lastWeek.clk) good.push('광고비 절감하면서 클릭 유지');

  if (thisWeek.conv === 0 && thisWeek.clk > 20) improve.push('클릭은 있으나 전환 없음 — 랜딩페이지 점검 필요');

  // 예산 시나리오
  const monthlyBudget = dailyBudget * 30;
  const estClicks = dailyBudget > 0 && thisWeek.cost > 0 ? Math.round(thisWeek.clk * (dailyBudget * 7 / thisWeek.cost)) : 0;
  if (dailyBudget > 0) {
    recommend.push(`현재 일예산 ${dailyBudget.toLocaleString()}원 → 월 ${monthlyBudget.toLocaleString()}원`);
    if (estClicks > 0) recommend.push(`예상 주간 클릭: ${estClicks}회`);
  }

  return { good, improve, recommend };
}

// 노출 진단 체크리스트
export interface DiagnosisItem {
  icon: string;  // ✅ ⚠️ 🔴 ❓
  label: string;
  detail: string;
  severity: 'ok' | 'warn' | 'error' | 'info';
}

export interface DiagnosisResult {
  keyword: string;
  items: DiagnosisItem[];
  cause: string;
  recommendations: string[];
  rankScore: number; // 입찰가 × QI
}

export function diagnoseKeyword(params: {
  keyword: string;
  bidAmt: number;
  status: string;
  qiGrade: number;
  campaignOn: boolean;
  adGroupOn: boolean;
  keywordOn: boolean;
  adInspectStatus?: string; // APPROVED, PENDING, DISAPPROVED
  bizMoney: number;
  todayCost: number;
  dailyBudget: number;
  rank1Bid: number;
  rank3Bid: number;
}): DiagnosisResult {
  const items: DiagnosisItem[] = [];
  const recommendations: string[] = [];
  const { keyword, bidAmt, qiGrade, campaignOn, adGroupOn, keywordOn, adInspectStatus, bizMoney, todayCost, dailyBudget, rank1Bid, rank3Bid } = params;

  // ① 캠페인/그룹/키워드 ON 여부
  items.push({ icon: campaignOn ? '✅' : '🔴', label: `캠페인 ${campaignOn ? 'ON' : 'OFF'}`, detail: campaignOn ? '' : '캠페인이 꺼져 있어 모든 키워드 미노출', severity: campaignOn ? 'ok' : 'error' });
  items.push({ icon: adGroupOn ? '✅' : '🔴', label: `광고그룹 ${adGroupOn ? 'ON' : 'OFF'}`, detail: adGroupOn ? '' : '광고그룹이 꺼져 있음', severity: adGroupOn ? 'ok' : 'error' });
  items.push({ icon: keywordOn ? '✅' : '🔴', label: `키워드 ${keywordOn ? 'ON' : 'OFF'}`, detail: keywordOn ? '' : '키워드가 비활성 상태', severity: keywordOn ? 'ok' : 'error' });

  // ④ 입찰가
  items.push({ icon: '✅', label: `입찰가 ${bidAmt.toLocaleString()}원`, detail: '', severity: 'ok' });

  // ⑤ 비즈머니
  if (bizMoney <= 0) {
    items.push({ icon: '🔴', label: '비즈머니 0원', detail: '광고비 잔액 없음 — 즉시 충전 필요', severity: 'error' });
    recommendations.push('비즈머니를 충전하세요');
  } else if (bizMoney < 10000) {
    items.push({ icon: '⚠️', label: `비즈머니 ${Math.floor(bizMoney).toLocaleString()}원`, detail: '잔액 부족 — 곧 광고 중단 가능', severity: 'warn' });
    recommendations.push('비즈머니 충전 권장');
  } else {
    items.push({ icon: '✅', label: `비즈머니 충분 (${Math.floor(bizMoney).toLocaleString()}원)`, detail: '', severity: 'ok' });
  }

  // ③ 품질지수
  const rankScore = bidAmt * Math.max(qiGrade, 1);
  if (qiGrade <= 2) {
    items.push({ icon: '🔴', label: `품질지수: ${qiGrade}칸 (낮음)`, detail: `순위점수: ${bidAmt.toLocaleString()} × ${qiGrade} = ${rankScore.toLocaleString()}`, severity: 'error' });
    recommendations.push('소재 문구를 키워드와 더 관련성 있게 수정하세요');
  } else if (qiGrade <= 4) {
    items.push({ icon: '⚠️', label: `품질지수: ${qiGrade}칸 (보통)`, detail: `순위점수: ${bidAmt.toLocaleString()} × ${qiGrade} = ${rankScore.toLocaleString()}`, severity: 'warn' });
    recommendations.push('품질지수 개선 시 같은 입찰가로 더 높은 순위 가능');
  } else {
    items.push({ icon: '✅', label: `품질지수: ${qiGrade}칸 (${qiGrade >= 7 ? '최고' : '좋음'})`, detail: `순위점수: ${bidAmt.toLocaleString()} × ${qiGrade} = ${rankScore.toLocaleString()}`, severity: 'ok' });
  }

  // ② 소재 검수 상태
  if (adInspectStatus === 'PENDING' || adInspectStatus === 'UNDER_REVIEW') {
    items.push({ icon: '🔴', label: '소재 검수: 심사중', detail: '심사 완료 전까지 미노출', severity: 'error' });
    recommendations.push('소재 심사 완료를 기다려주세요 (보통 1~3일)');
  } else if (adInspectStatus === 'DISAPPROVED') {
    items.push({ icon: '🔴', label: '소재 검수: 반려됨', detail: '소재가 반려되어 노출 불가', severity: 'error' });
    recommendations.push('소재를 수정하고 재검수를 신청하세요');
  } else if (adInspectStatus === 'APPROVED') {
    items.push({ icon: '✅', label: '소재 검수: 승인', detail: '', severity: 'ok' });
  }

  // ④ 일예산 소진
  if (dailyBudget > 0) {
    const usagePct = Math.round(todayCost / dailyBudget * 100);
    if (usagePct >= 95) {
      items.push({ icon: '🔴', label: `일예산 소진 (${usagePct}%)`, detail: `오늘 ${todayCost.toLocaleString()}원 / 일예산 ${dailyBudget.toLocaleString()}원`, severity: 'error' });
      recommendations.push('일예산을 증액하세요');
    } else {
      items.push({ icon: '✅', label: `일예산 ${usagePct}% 사용`, detail: `오늘 ${todayCost.toLocaleString()}원 / ${dailyBudget.toLocaleString()}원`, severity: 'ok' });
    }
  }

  // ⑤ 입찰가 × QI 순위점수 비교
  if (rank3Bid > 0) {
    const competitorScore3 = rank3Bid * 4; // 경쟁사 QI 4 가정
    const requiredBid = Math.ceil(competitorScore3 / Math.max(qiGrade, 1));
    if (rankScore < competitorScore3) {
      items.push({ icon: '⚠️', label: `순위점수 부족`, detail: `내 ${rankScore.toLocaleString()} < 3위 추정 ${competitorScore3.toLocaleString()}\n품질지수 (QI) ${qiGrade} 기준 필요 입찰가: ${requiredBid.toLocaleString()}원`, severity: 'warn' });
      recommendations.push(`입찰가를 ${requiredBid.toLocaleString()}원 이상으로 올리세요`);
    }
  }

  // 추정 원인 판단
  const errors = items.filter(i => i.severity === 'error');
  const warns = items.filter(i => i.severity === 'warn');
  let cause = '전부 정상 — 검색량 없거나 경쟁 과다일 수 있음';
  if (errors.length > 0) {
    const first = errors[0];
    if (first.label.includes('소재')) cause = '소재 심사 중으로 인한 미노출';
    else if (first.label.includes('비즈머니')) cause = '비즈머니 부족으로 광고 중단';
    else if (first.label.includes('일예산')) cause = '일예산 소진으로 노출 중단';
    else if (!campaignOn || !adGroupOn || !keywordOn) cause = '캠페인/그룹/키워드 OFF 상태';
    else if (first.label.includes('품질')) cause = '품질지수 낮음으로 노출 제한';
  } else if (warns.length > 0) {
    if (warns.some(w => w.label.includes('순위점수'))) cause = '순위점수 부족 — 입찰가 인상 또는 품질지수 (QI) 개선 필요';
    else if (warns.some(w => w.label.includes('품질'))) cause = '품질지수 보통 — 개선 시 노출 확대 가능';
  }

  recommendations.push(`네이버에서 직접 검색하여 노출 확인`);

  return { keyword, items, cause, recommendations, rankScore };
}

// 소재 AI 추천 (규칙 기반)
export function generateAdSuggestions(
  productName: string,
  region: string,
): { headlines: string[]; descriptions: string[] } {
  const headlines = [
    `${region} ${productName} 분양`,
    `${productName} 특별분양`,
    `${region} 신규분양 안내`,
  ].map(h => h.slice(0, 15));

  const descriptions = [
    `${region} ${productName} 파격 할인 분양 중. 지금 상담받으세요!`,
    `GTX 수혜 ${productName}. 입주자 모집 중. 무료 상담 예약`,
    `${region} 핫플 ${productName}. 선착순 특별할인. 지금 확인!`,
  ].map(d => d.slice(0, 45));

  return { headlines, descriptions };
}
