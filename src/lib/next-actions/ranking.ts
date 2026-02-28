/**
 * Phase 4.1: NBA ranking v2 — structured scoring with tie-breakers.
 * Phase 7.1: Learned weights for personalization.
 */

import { NextActionPriority } from "@prisma/client";
import type { NextActionCandidate } from "./types";

const PRIORITY_BASE: Record<NextActionPriority, number> = {
  critical: 90,
  high: 75,
  medium: 55,
  low: 30,
};

const PRIORITY_ORDER: NextActionPriority[] = ["critical", "high", "medium", "low"];

export type LearnedWeightsParam = {
  ruleWeights: Map<string, number>;
  actionWeights: Map<string, number>;
};

/** Phase 7.3: Effectiveness by ruleKey (netLiftScore) for ranking boost. */
export type EffectivenessByRuleKey = Map<string, number>;

export type ScoreFactors = {
  base: number;
  countBoost: number;
  recencyBoost: number;
  urgencyBoost: number;
  impactBoost: number;
  frictionPenalty: number;
  dedupePenalty: number;
  learnedBoost: number;
  total: number;
};

export type RankedCandidate = NextActionCandidate & {
  _rankFactors?: ScoreFactors;
};

/**
 * Compute total score for a candidate. Deterministic when now is provided.
 * Phase 7.1: Applies learned weights (ruleWeight*2, actionWeight*1) and penalty when ruleWeight <= -3.
 */
export function computeNextActionScore(
  action: Omit<NextActionCandidate, "score">,
  ctx: {
    now: Date;
    existingInScope?: string[];
    learnedWeights?: LearnedWeightsParam;
    effectivenessByRuleKey?: EffectivenessByRuleKey;
  },
  _testOverride?: { now?: Date }
): { total: number; factors: ScoreFactors } {
  const now = _testOverride?.now ?? ctx.now;

  let base = PRIORITY_BASE[action.priority];
  const countBoost = Math.min(10, action.countBoost ?? 0);
  const recencyBoost = Math.min(10, action.recencyBoost ?? 0);
  let urgencyBoost = Math.min(10, action.urgencyBoost ?? 0);
  let impactBoost = Math.min(10, action.impactBoost ?? 0);
  const frictionPenalty = Math.min(5, action.frictionPenalty ?? 0);
  const dedupePenalty = ctx.existingInScope?.includes(action.dedupeKey) ? 5 : 0;

  let learnedBoost = 0;
  if (ctx.learnedWeights) {
    const ruleWeight = ctx.learnedWeights.ruleWeights.get(action.createdByRule) ?? 0;
    const actionWeight = ctx.learnedWeights.actionWeights.get("mark_done") ?? 0;
    learnedBoost += ruleWeight * 2;
    learnedBoost += actionWeight * 1;
    if (ruleWeight <= -3) {
      learnedBoost -= 3;
    }
  }

  let effectivenessBoost = 0;
  if (ctx.effectivenessByRuleKey) {
    const netLift = ctx.effectivenessByRuleKey.get(action.createdByRule) ?? 0;
    effectivenessBoost = Math.max(-6, Math.min(6, Math.round(netLift)));
  }

  // Impact: critical band, high failed count, etc.
  if (action.priority === "critical") impactBoost = Math.max(impactBoost, 5);
  if ((action.payloadJson as Record<string, unknown>)?.entityType === "command_center" && action.priority === "high") {
    impactBoost = Math.max(impactBoost, 3);
  }

  const total = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        base +
          countBoost +
          recencyBoost +
          urgencyBoost +
          impactBoost -
          frictionPenalty -
          dedupePenalty +
          learnedBoost +
          effectivenessBoost
      )
    )
  );

  return {
    total,
    factors: {
      base,
      countBoost,
      recencyBoost,
      urgencyBoost,
      impactBoost,
      frictionPenalty,
      dedupePenalty,
      learnedBoost,
      total,
    },
  };
}

/**
 * Rank actions with stable tie-breakers.
 * 1) totalScore desc
 * 2) priority band severity desc
 * 3) urgency desc
 * 4) recency desc
 * 5) dedupeKey asc (deterministic)
 * Phase 7.1: learnedWeights optional for personalization.
 */
export function rankNextActions(
  actions: NextActionCandidate[],
  now: Date,
  existingInScope: string[] = [],
  learnedWeights?: LearnedWeightsParam,
  effectivenessByRuleKey?: EffectivenessByRuleKey
): RankedCandidate[] {
  const withScores = actions.map((a) => {
    const { total, factors } = computeNextActionScore(a, {
      now,
      existingInScope,
      learnedWeights,
      effectivenessByRuleKey,
    });
    return { ...a, score: total, _rankFactors: factors } as RankedCandidate;
  });

  return withScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aPri = PRIORITY_ORDER.indexOf(a.priority);
    const bPri = PRIORITY_ORDER.indexOf(b.priority);
    if (aPri !== bPri) return aPri - bPri; // critical first
    const aUrg = a.urgencyBoost ?? 0;
    const bUrg = b.urgencyBoost ?? 0;
    if (bUrg !== aUrg) return bUrg - aUrg;
    const aRec = a.recencyBoost ?? 0;
    const bRec = b.recencyBoost ?? 0;
    if (bRec !== aRec) return bRec - aRec;
    return (a.dedupeKey ?? "").localeCompare(b.dedupeKey ?? "");
  });
}
