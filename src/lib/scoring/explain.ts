/**
 * Phase 3.1: Score explanation — top factors affecting score.
 */

import type { ScoreFactorResult, ScoreReason } from "./types";

/** Build top reasons from factor breakdown. Top negative first, then positive. */
export function buildReasons(
  factorBreakdown: ScoreFactorResult[],
  maxCount = 5
): ScoreReason[] {
  const negative = factorBreakdown
    .filter((f) => f.direction === "negative" && f.impact < 0)
    .sort((a, b) => a.impact - b.impact);

  const positive = factorBreakdown
    .filter((f) => f.direction === "positive" && f.impact > 0)
    .sort((a, b) => b.impact - a.impact);

  const combined: ScoreReason[] = [];
  combined.push(
    ...negative.slice(0, Math.ceil(maxCount / 2)).map((f) => ({
      label: f.reason ?? f.label,
      impact: f.impact,
      direction: "negative" as const,
    }))
  );
  combined.push(
    ...positive.slice(0, Math.floor(maxCount / 2)).map((f) => ({
      label: f.reason ?? f.label,
      impact: f.impact,
      direction: "positive" as const,
    }))
  );

  return combined.slice(0, maxCount);
}
