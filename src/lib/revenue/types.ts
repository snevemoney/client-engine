/**
 * Revenue-focused types: ROI estimates, follow-up, scorecard extensions.
 */

export type RoiEstimate = {
  timeWasteEstimateHoursPerWeek: { min: number; max: number } | null;
  toolCostWastePerMonth: { min: number; max: number } | null;
  lostRevenueRiskPerMonth: { min: number; max: number } | null;
  implementationEffortEstimate: "small" | "medium" | "large";
  confidence: number;
  assumptions: string[];
  whyNow: string;
  pilotRecommendation: string;
  expectedPilotOutcome: string[];
};

export const ROI_ESTIMATE_ARTIFACT_TYPE = "ROI_ESTIMATE";
export const FOLLOWUP_SEQUENCE_DRAFT_ARTIFACT_TYPE = "FOLLOWUP_SEQUENCE_DRAFT";
export const FOLLOWUP_TOUCHPOINT_LOG_ARTIFACT_TYPE = "FOLLOWUP_TOUCHPOINT_LOG";

export type FollowUpTouch = {
  subject: string;
  body: string;
  tone: "calm" | "professional";
  variant?: "short" | "standard";
  suggestedSendAfterDays?: number;
};

export type FollowUpSequence = {
  leadId: string;
  touches: FollowUpTouch[];
  generatedAt: string;
};
