/**
 * Types for V3 recommendations engine.
 */

export type EntityType = "campaign" | "adset" | "ad";

export type ActionType =
  | "pause"
  | "resume"
  | "increase_budget"
  | "decrease_budget"
  | "refresh_creative"
  | "wait";

export type Severity = "info" | "warn" | "critical";

export type Confidence = "low" | "medium" | "high";

export type RecommendationStatus =
  | "queued"
  | "approved"
  | "dismissed"
  | "applied"
  | "failed"
  | "false_positive";

export type RecommendationEvidence = {
  spend?: number;
  leads?: number;
  cpl?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  frequency?: number;
  impressions?: number;
  delivery?: string | null;
  learning?: string | null;
};

export type RecommendationOutput = {
  ruleKey: string;
  entityType: EntityType;
  entityId: string;
  campaignId?: string;
  entityName: string;
  severity: Severity;
  confidence: Confidence;
  reason: string;
  evidence: RecommendationEvidence;
  actionType: ActionType;
  actionPayload: Record<string, unknown>;
};

export type AutomationSettingsInput = {
  targetCpl: number | null;
  minSpendForDecision: number;
  minImpressionsForDecision: number;
  maxBudgetIncreasePctPerAction: number;
  maxBudgetIncreasePctPerDay: number;
  allowChangesDuringLearning: boolean;
  protectedCampaignIds: string[];
};
