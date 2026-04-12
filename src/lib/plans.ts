export const PLAN_LIMITS = {
  free: {
    ipBlockPerMonth: 3,
    aiAnalysisPerMonth: 1,
    logDays: 3,
    autobidKeywords: 0,
    sites: 1,
    exportCsv: false,
    googleIntegration: false,
    metaIntegration: false,
    weeklyReport: false,
  },
  starter: {
    ipBlockPerMonth: Infinity,
    aiAnalysisPerMonth: 30,
    logDays: 90,
    autobidKeywords: 50,
    sites: 1,
    exportCsv: true,
    googleIntegration: false,
    metaIntegration: false,
    weeklyReport: false,
  },
  growth: {
    ipBlockPerMonth: Infinity,
    aiAnalysisPerMonth: 100,
    logDays: 365,
    autobidKeywords: 200,
    sites: 3,
    exportCsv: true,
    googleIntegration: true,
    metaIntegration: false,
    weeklyReport: true,
  },
  pro: {
    ipBlockPerMonth: Infinity,
    aiAnalysisPerMonth: Infinity,
    logDays: 365,
    autobidKeywords: Infinity,
    sites: 5,
    exportCsv: true,
    googleIntegration: true,
    metaIntegration: true,
    weeklyReport: true,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

// 임시: 현재 사용자 플랜 (나중에 Supabase에서 조회)
export const CURRENT_PLAN: PlanType = 'free';

export function getLimits(plan: PlanType = CURRENT_PLAN) {
  return PLAN_LIMITS[plan];
}
