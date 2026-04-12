// ============================================
// HitAD TypeScript 타입 정의
// ============================================

export interface AdAccount {
  id: string;
  userId: string;
  name: string;
  naverCustomerId: string;
  naverApiKeyEncrypted?: string;
  naverSecretKeyEncrypted?: string;
  targetCpa: number;
  dailyBudget: number;
  strategy: AdStrategy;
  isActive: boolean;
  isAuto?: boolean;
  targetCampaignId?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdStrategy = 'grade' | 'target_rank' | 'smart';

export interface AdGroupSetting {
  id: string;
  adAccountId: string;
  groupName: string;
  targetCpa: number;
  maxBid: number;
  minBid: number;
  targetRank: number;
  dailyBudget: number | null;
  isAuto: boolean;
  createdAt: string;
}

export interface AdBidLog {
  id: string;
  adAccountId: string;
  strategy: string;
  totalKeywords: number;
  totalChanged: number;
  totalSkipped: number;
  avgBid: number;
  elapsedMs: number;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdIpEntry {
  id: string;
  adAccountId: string;
  ip: string;
  description: string | null;
  clickCount: number;
  type: 'blacklist' | 'whitelist';
  naverRegistered: boolean;
  naverFilterId: string | null;
  registeredAt: string | null;
  createdAt: string;
}

export interface AdWhitelist {
  id: string;
  adAccountId: string;
  ip: string;
  description: string | null;
  type: 'whitelist';
  createdAt: string;
}

export interface AdReport {
  id: string;
  adAccountId: string;
  reportDate: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpa: number;
  ctr: number;
  cpc: number;
  bidChanges: number;
  ipBlocked: number;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdTimeStrategy {
  id: string;
  adAccountId: string;
  isEnabled: boolean;
  strategyGrid: TimeStrategyGrid | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeStrategyGrid {
  [hour: string]: {
    [day: string]: 'aggressive' | 'normal' | 'conservative' | 'off';
  };
}

export interface NaverCampaign {
  nccCampaignId: string;
  name: string;
  userLock: boolean;
  dailyBudget: number;
  status: 'ELIGIBLE' | 'PAUSED';
  campaignTp: string;
  customerId: number;
  expectCost: number;
  totalChargeCost: number;
}

export interface NaverAdGroup {
  nccAdgroupId: string;
  nccCampaignId: string;
  name: string;
  bidAmt: number;
  budgetLock: boolean;
  dailyBudget: number;
  userLock: boolean;
  status: string;
  targets: Record<string, unknown>;
}

export interface NaverKeyword {
  nccKeywordId: string;
  keyword: string;
  bidAmt: number;
  useGroupBidAmt: boolean;
  nccAdgroupId: string;
  adGroupName?: string;
  status?: string;
  managedKeyword?: boolean;
  nccQi?: { qiGrade: number };
  userLock?: boolean;
}

export interface PerformanceData {
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface DailyPerformance extends PerformanceData {
  date: string;
}

export interface IpEntry {
  ip: string;
  clickCount: number;
  firstSeen: string;
  lastSeen: string;
  riskLevel: 'danger' | 'warning' | 'normal';
  naverRegistered: boolean;
}

// Supabase DB → 프론트 변환 유틸 타입
export interface AdAccountRow {
  id: string;
  user_id: string;
  name: string;
  naver_customer_id: string;
  naver_api_key_encrypted: string | null;
  naver_secret_key_encrypted: string | null;
  target_cpa: number;
  daily_budget: number;
  strategy: string;
  is_active: boolean;
  target_campaign_id: string | null;
  is_auto?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdReportRow {
  id: string;
  ad_account_id: string;
  report_date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  cpa: number;
  ctr: number;
  cpc: number;
  bid_changes: number;
  ip_blocked: number;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AdBidLogRow {
  id: string;
  ad_account_id: string;
  strategy: string;
  total_keywords: number;
  total_changed: number;
  total_skipped: number;
  avg_bid: number;
  elapsed_ms: number;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AdGroupSettingRow {
  id: string;
  ad_account_id: string;
  group_name: string;
  target_cpa: number;
  max_bid: number;
  min_bid: number;
  target_rank: number;
  daily_budget: number | null;
  is_auto: boolean;
  created_at: string;
}

export interface AdIpBlacklistRow {
  id: string;
  ad_account_id: string;
  ip: string;
  description: string | null;
  click_count: number;
  type: string;
  naver_registered: boolean;
  naver_filter_id: string | null;
  registered_at: string | null;
  created_at: string;
}

export interface AdTimeStrategyRow {
  id: string;
  ad_account_id: string;
  is_enabled: boolean;
  strategy_grid: TimeStrategyGrid | null;
  created_at: string;
  updated_at: string;
}

// 히트AD 내부 탭 타입
export type HitAdTab =
  | 'dashboard'
  | 'campaigns'
  | 'keywords'
  | 'keyword-strategy'
  | 'ads'
  | 'diagnosis'
  | 'blocking'
  | 'automation'
  | 'reports'
  | 'bulk'
  | 'targeting'
  | 'changelogs'
  | 'channels'
  | 'conversion'
  | 'visit-analytics'
  | 'settings';
