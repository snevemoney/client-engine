/**
 * Phase 3.1: Reviews score adapter — StrategyWeek + StrategyWeekReview.
 * Maps review/completion data to scoring factors.
 */

import type { ScoreFactorInput } from "../types";

export type ReviewsAdapterContext = {
  weekStart: Date;
  reviewCompleted: boolean;
  reviewScore: number | null; // 0-100 from StrategyWeekReview.score
  campaignShipped: boolean;
  systemImproved: boolean;
  salesActionsDone: boolean;
  proofCaptured: boolean;
  prioritiesTotal: number;
  prioritiesDone: number;
  risksOpen: number;
};

/** Build factors from review context. */
export function buildReviewsFactors(ctx: ReviewsAdapterContext): ScoreFactorInput[] {
  const factors: ScoreFactorInput[] = [];

  // Review completion (highest weight)
  factors.push({
    key: "review_completed",
    label: "Review completed",
    rawValue: ctx.reviewCompleted ? 1 : 0,
    normalizedValue: ctx.reviewCompleted ? 100 : 0,
    weight: 3,
    direction: "positive",
    reason: ctx.reviewCompleted ? "Weekly review completed" : "Weekly review not completed",
  });

  // Manual score from review (if present)
  if (ctx.reviewScore != null) {
    factors.push({
      key: "review_score",
      label: "Operator self-score",
      rawValue: ctx.reviewScore,
      normalizedValue: Math.max(0, Math.min(100, ctx.reviewScore)),
      weight: 2,
      direction: "positive",
      reason: `Self-assessed score: ${ctx.reviewScore}`,
    });
  }

  // Campaign shipped
  factors.push({
    key: "campaign_shipped",
    label: "Campaign shipped",
    rawValue: ctx.campaignShipped ? 1 : 0,
    normalizedValue: ctx.campaignShipped ? 100 : 50, // 50 = neutral if not applicable
    weight: 1.5,
    direction: "positive",
    reason: ctx.campaignShipped ? "Campaign shipped" : "Campaign not shipped",
  });

  // System improved
  factors.push({
    key: "system_improved",
    label: "System improved",
    rawValue: ctx.systemImproved ? 1 : 0,
    normalizedValue: ctx.systemImproved ? 100 : 50,
    weight: 1,
    direction: "positive",
    reason: ctx.systemImproved ? "System improved" : "No system improvement",
  });

  // Sales actions done
  factors.push({
    key: "sales_actions_done",
    label: "Sales actions done",
    rawValue: ctx.salesActionsDone ? 1 : 0,
    normalizedValue: ctx.salesActionsDone ? 100 : 50,
    weight: 1,
    direction: "positive",
    reason: ctx.salesActionsDone ? "Sales actions completed" : "Sales actions pending",
  });

  // Proof captured
  factors.push({
    key: "proof_captured",
    label: "Proof captured",
    rawValue: ctx.proofCaptured ? 1 : 0,
    normalizedValue: ctx.proofCaptured ? 100 : 50,
    weight: 1,
    direction: "positive",
    reason: ctx.proofCaptured ? "Proof captured" : "Proof not captured",
  });

  // Priorities completion
  const prioritiesPct =
    ctx.prioritiesTotal > 0 ? (ctx.prioritiesDone / ctx.prioritiesTotal) * 100 : 100;
  factors.push({
    key: "priorities_completion",
    label: "Priorities completion",
    rawValue: prioritiesPct,
    normalizedValue: prioritiesPct,
    weight: 1.5,
    direction: "positive",
    reason: `${ctx.prioritiesDone}/${ctx.prioritiesTotal} priorities done`,
  });

  // Open risks (negative factor)
  const riskPenalty = Math.min(100, ctx.risksOpen * 25);
  factors.push({
    key: "risks_open",
    label: "Open risks",
    rawValue: ctx.risksOpen,
    normalizedValue: 100 - riskPenalty,
    weight: 1,
    direction: "negative",
    reason: ctx.risksOpen > 0 ? `${ctx.risksOpen} open risk(s)` : "No open risks",
  });

  return factors;
}
