/**
 * Phase 3.1: Score Engine — weighted factors, normalized output, bands.
 */

import type {
  ScoreBand,
  ScoreComputationInput,
  ScoreComputationResult,
  ScoreFactorResult,
  ScoreThresholds,
} from "./types";
import { DEFAULT_THRESHOLDS } from "./types";
import { buildReasons } from "./explain";

export { DEFAULT_THRESHOLDS } from "./types";

/** Clamp value to 0–100. */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Assign band from score using thresholds. */
export function assignBand(
  score: number,
  thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
): ScoreBand {
  if (score >= thresholds.healthyMin) return "healthy";
  if (score >= thresholds.warningMin) return "warning";
  return "critical";
}

/** Compute weighted score from factors. */
export function computeScore(input: ScoreComputationInput): ScoreComputationResult {
  const thresholds = input.thresholds ?? DEFAULT_THRESHOLDS;
  const factors = input.factors;

  if (factors.length === 0) {
    return {
      score: 50,
      band: assignBand(50, thresholds),
      reasons: [],
      factorBreakdown: [],
      computedAt: new Date(),
    };
  }

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const weightSum = totalWeight > 0 ? totalWeight : 1;

  let weightedSum = 0;
  const factorBreakdown: ScoreFactorResult[] = factors.map((f) => {
    const clamped = clamp(f.normalizedValue);
    const weighted = (clamped * f.weight) / weightSum;
    weightedSum += weighted;

    const impact =
      f.direction === "positive"
        ? weighted
        : weighted - (f.weight / weightSum) * 100;

    return {
      key: f.key,
      label: f.label,
      rawValue: f.rawValue,
      normalizedValue: clamped,
      weight: f.weight,
      impact,
      direction: f.direction,
      reason: f.reason,
    };
  });

  const score = clamp(weightedSum);
  const band = assignBand(score, thresholds);
  const reasons = buildReasons(factorBreakdown);

  return {
    score,
    band,
    reasons,
    factorBreakdown,
    computedAt: new Date(),
  };
}
