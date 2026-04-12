// Claude AI API 호출 (AdConcent Worker 경유)

const HITAD_AI_URL = 'https://adconcent-worker.noble-kclee.workers.dev/ai';

async function callHitadAi<T>(action: string, data: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(HITAD_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

// AI 브리핑 생성
export async function aiBriefing(params: {
  totals: { imp: number; clk: number; cost: number; conv: number };
  bizMoney: number;
  targetCpa: number;
  dailyBudget: number;
  keywords?: number;
}): Promise<{ summary: string; details: string[]; actions: { text: string; level: 'urgent' | 'warn' | 'info'; tab?: string }[] } | null> {
  return callHitadAi('briefing', params as unknown as Record<string, unknown>);
}

// 키워드 건강도 AI 분석
export async function aiKeywordHealth(params: {
  keyword: string;
  bidAmt: number;
  qiGrade: number;
  rank1Bid: number;
  rank3Bid: number;
  status: string;
  impressions?: number;
  clicks?: number;
}): Promise<{ icon: string; message: string; color: string; action?: string } | null> {
  return callHitadAi('keyword_health', params as unknown as Record<string, unknown>);
}

// 소재 AI 추천
export async function aiAdSuggestions(params: {
  productName: string;
  region: string;
  keywords?: string[];
  currentAds?: unknown[];
}): Promise<{ headlines: string[]; descriptions: string[]; reasoning: string } | null> {
  return callHitadAi('ad_suggestions', params as unknown as Record<string, unknown>);
}

// 주간 인사이트 AI
export async function aiWeeklyInsight(params: {
  thisWeek: { imp: number; clk: number; cost: number; conv: number };
  lastWeek: { imp: number; clk: number; cost: number; conv: number };
  dailyBudget: number;
  keywords?: number;
}): Promise<{ good: string[]; improve: string[]; recommend: string[] } | null> {
  return callHitadAi('weekly_insight', params as unknown as Record<string, unknown>);
}

// 노출 진단 AI
export async function aiDiagnose(params: {
  keyword: string;
  bidAmt: number;
  qiGrade: number;
  campaignOn: boolean;
  adGroupOn: boolean;
  keywordOn: boolean;
  adInspectStatus?: string;
  bizMoney: number;
  todayCost: number;
  dailyBudget: number;
  rank1Bid: number;
  rank3Bid: number;
}): Promise<{ items: { icon: string; label: string; detail: string; severity: string }[]; cause: string; recommendations: string[]; rankScore: number } | null> {
  return callHitadAi('diagnose', params as unknown as Record<string, unknown>);
}
