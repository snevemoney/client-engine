/**
 * Phase 3.1: Score Engine types.
 */

export type ScoreBand = "healthy" | "warning" | "critical";

export type FactorDirection = "positive" | "negative";

/** Input for a single scoring factor. */
export type ScoreFactorInput = {
  key: string;
  label: string;
  rawValue: number;
  normalizedValue: number; // 0-100, higher is better
  weight: number;
  direction: FactorDirection;
  reason?: string;
};

/** Result for a single factor after engine processing. */
export type ScoreFactorResult = {
  key: string;
  label: string;
  rawValue: number;
  normalizedValue: number;
  weight: number;
  impact: number; // contribution to final score
  direction: FactorDirection;
  reason?: string;
};

/** Input for score computation. */
export type ScoreComputationInput = {
  factors: ScoreFactorInput[];
  thresholds?: ScoreThresholds;
};

/** Output of score computation. */
export type ScoreComputationResult = {
  score: number;
  band: ScoreBand;
  reasons: ScoreReason[];
  factorBreakdown: ScoreFactorResult[];
  computedAt: Date;
};

/** Top reasons affecting score (positive/negative). */
export type ScoreReason = {
  label: string;
  impact: number;
  direction: FactorDirection;
};

/** Configurable band thresholds. */
export type ScoreThresholds = {
  healthyMin: number;
  warningMin: number;
  // critical: < warningMin
};

export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  healthyMin: 80,
  warningMin: 50,
};
