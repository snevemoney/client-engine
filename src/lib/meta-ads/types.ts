/**
 * Normalized types for Meta Ads Monitor (read-only V1).
 * Maps raw Meta Graph API responses to stable internal shapes.
 */

export type DateRangePreset = "today" | "yesterday" | "last_7d" | "last_14d" | "last_30d";

export type MetaAdsSummary = {
  spend: number;
  impressions: number;
  reach: number | null;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number | null;
  costPerLead: number | null;
  /** Trend deltas vs prior period (null if not computable) */
  spendDeltaPct: number | null;
  leadsDeltaPct: number | null;
  cplDeltaPct: number | null;
  ctrDeltaPct: number | null;
};

export type MetaAdsCampaign = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string | null;
  spend: number;
  impressions: number;
  reach: number | null;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  frequency: number | null;
  costPerLead: number | null;
  deliveryStatus: string | null;
  learningStatus: string | null;
  reviewStatus: string | null;
};

export type MetaAdsAdSet = MetaAdsCampaign & { campaignId: string };

export type MetaAdsAd = MetaAdsCampaign & {
  adSetId: string;
  campaignId?: string;
  creativeId: string | null;
  thumbnailUrl: string | null;
};

export type OperatorInsight = {
  severity: "info" | "warn" | "critical";
  entityType: "account" | "campaign" | "adset" | "ad";
  entityId: string;
  entityName: string;
  message: string;
  suggestedAction: string;
};

export type MetaAdsDashboardData = {
  ok: true;
  accountId: string;
  range: { since: string; until: string };
  datePreset: DateRangePreset;
  lastFetchedAt: string;
  /** When cache was last populated (for cacheHit) */
  lastSyncedAt?: string;
  /** True if response came from cache */
  cacheHit?: boolean;
  summary: MetaAdsSummary;
  campaigns: MetaAdsCampaign[];
  adsets: MetaAdsAdSet[];
  ads: MetaAdsAd[];
  insights: OperatorInsight[];
};

export type MetaAdsDashboardError = {
  ok: false;
  error: string;
  code?: string;
};
