/**
 * Phase 7.3: Effectiveness aggregates — net lift, noisy rules, weight suggestions.
 */
import { db } from "@/lib/db";
import { OperatorAttributionSourceType } from "@prisma/client";

export type RuleEffectiveness = {
  ruleKey: string;
  executions: number;
  avgRiskOpenDelta: number;
  avgRiskCriticalDelta: number;
  avgScoreDelta: number | null;
  bandImprovementRate: number;
  netLiftScore: number;
  dismissCount?: number;
};

const NET_LIFT_BOUND = 10;
const EFFECTIVENESS_BOOST_BOUND = 6;

/** Strong positive: riskCriticalDelta < 0 OR band improves OR scoreDelta >= 5 */
function strongPositive(d: { riskCriticalDelta?: number; bandChange?: { from: string; to: string } | null; scoreDelta?: number | null }): boolean {
  if ((d.riskCriticalDelta ?? 0) < 0) return true;
  if (d.bandChange) {
    const order = ["critical", "warning", "healthy"];
    const fromR = order.indexOf(d.bandChange.from);
    const toR = order.indexOf(d.bandChange.to);
    if (toR >= 0 && fromR >= 0 && toR > fromR) return true;
  }
  if ((d.scoreDelta ?? 0) >= 5) return true;
  return false;
}

/** Strong negative: band worsens OR riskCriticalDelta > 0 OR scoreDelta <= -5 */
function strongNegative(d: { riskCriticalDelta?: number; bandChange?: { from: string; to: string } | null; scoreDelta?: number | null }): boolean {
  if ((d.riskCriticalDelta ?? 0) > 0) return true;
  if (d.bandChange) {
    const order = ["critical", "warning", "healthy"];
    const fromR = order.indexOf(d.bandChange.from);
    const toR = order.indexOf(d.bandChange.to);
    if (toR >= 0 && fromR >= 0 && toR < fromR) return true;
  }
  if ((d.scoreDelta ?? 0) <= -5) return true;
  return false;
}

/**
 * Compute effectiveness aggregates per ruleKey over a time range.
 */
export async function computeEffectiveness(
  actorUserId: string,
  from: Date,
  to: Date,
  dismissCountByRule?: Record<string, number>
): Promise<{
  byRuleKey: Record<string, RuleEffectiveness>;
  topEffectiveRuleKeys: Array<RuleEffectiveness>;
  topNoisyRuleKeys: Array<RuleEffectiveness>;
  recommendedWeightAdjustments: Array<{ ruleKey: string; suggestedDelta: number }>;
}> {
  const attributions = await db.operatorAttribution.findMany({
    where: {
      actorUserId,
      occurredAt: { gte: from, lt: to },
      sourceType: { in: [OperatorAttributionSourceType.nba_execute, OperatorAttributionSourceType.copilot_action] },
      ruleKey: { not: null },
    },
    select: { ruleKey: true, deltaJson: true },
  });

  const byRuleKey: Record<string, RuleEffectiveness> = {};
  const deltasByRule: Record<string, Array<{ riskOpenDelta: number; riskCriticalDelta: number; scoreDelta: number | null; bandChange: unknown }>> = {};

  for (const a of attributions) {
    const rk = a.ruleKey ?? "unknown";
    if (rk === "unknown") continue;

    const d = a.deltaJson as Record<string, unknown>;
    const riskOpenDelta = (d?.riskOpenDelta as number) ?? 0;
    const riskCriticalDelta = (d?.riskCriticalDelta as number) ?? 0;
    const scoreDelta = (d?.scoreDelta as number) ?? null;
    const bandChange = d?.bandChange ?? null;

    if (!deltasByRule[rk]) deltasByRule[rk] = [];
    deltasByRule[rk].push({ riskOpenDelta, riskCriticalDelta, scoreDelta, bandChange });
  }

  for (const [rk, deltas] of Object.entries(deltasByRule)) {
    const n = deltas.length;
    const avgRiskOpenDelta = deltas.reduce((s, d) => s + d.riskOpenDelta, 0) / n;
    const avgRiskCriticalDelta = deltas.reduce((s, d) => s + d.riskCriticalDelta, 0) / n;
    const scoreDeltas = deltas.map((d) => d.scoreDelta).filter((s): s is number => s !== null);
    const avgScoreDelta = scoreDeltas.length > 0 ? scoreDeltas.reduce((a, b) => a + b, 0) / scoreDeltas.length : null;
    const bandImprovements = deltas.filter((d) => {
      const bc = d.bandChange as { from?: string; to?: string } | null;
      if (!bc) return false;
      const order = ["critical", "warning", "healthy"];
      const fromR = order.indexOf(bc.from ?? "");
      const toR = order.indexOf(bc.to ?? "");
      return toR >= 0 && fromR >= 0 && toR > fromR; // higher index = better band
    }).length;
    const bandImprovementRate = n > 0 ? bandImprovements / n : 0;

    let netLiftScore = 0;
    for (const d of deltas) {
      const delta = {
        riskCriticalDelta: d.riskCriticalDelta,
        bandChange: d.bandChange as { from: string; to: string } | null | undefined,
        scoreDelta: d.scoreDelta,
      };
      if (strongPositive(delta)) netLiftScore += 2;
      else if (strongNegative(delta)) netLiftScore -= 2;
      else {
        netLiftScore += (delta.riskCriticalDelta < 0 ? 0.5 : 0) + (delta.riskCriticalDelta > 0 ? -0.5 : 0);
        netLiftScore += (delta.scoreDelta ?? 0) >= 2 ? 0.3 : (delta.scoreDelta ?? 0) <= -2 ? -0.3 : 0;
      }
    }
    netLiftScore = Math.max(-NET_LIFT_BOUND, Math.min(NET_LIFT_BOUND, netLiftScore / Math.max(1, n)));

    byRuleKey[rk] = {
      ruleKey: rk,
      executions: n,
      avgRiskOpenDelta,
      avgRiskCriticalDelta,
      avgScoreDelta,
      bandImprovementRate,
      netLiftScore,
      dismissCount: dismissCountByRule?.[rk],
    };
  }

  const sorted = Object.values(byRuleKey).sort((a, b) => b.netLiftScore - a.netLiftScore);
  const topEffectiveRuleKeys = sorted.filter((r) => r.netLiftScore > 0).slice(0, 10);
  const topNoisyRuleKeys = sorted
    .filter((r) => (r.dismissCount ?? 0) >= 2 && r.netLiftScore <= 0)
    .sort((a, b) => (b.dismissCount ?? 0) - (a.dismissCount ?? 0))
    .slice(0, 10);

  const recommendedWeightAdjustments = sorted
    .filter((r) => Math.abs(r.netLiftScore) >= 0.5)
    .map((r) => ({
      ruleKey: r.ruleKey,
      suggestedDelta: Math.max(-2, Math.min(2, Math.round(r.netLiftScore * 0.5))),
    }))
    .slice(0, 10);

  return {
    byRuleKey,
    topEffectiveRuleKeys,
    topNoisyRuleKeys,
    recommendedWeightAdjustments,
  };
}

/** Bounded effectiveness boost for ranking. */
export function effectivenessBoost(netLiftScore: number): number {
  return Math.max(-EFFECTIVENESS_BOOST_BOUND, Math.min(EFFECTIVENESS_BOOST_BOUND, Math.round(netLiftScore)));
}

/** Load effectiveness map for ranking (last 7d). */
export async function loadEffectivenessMap(
  actorUserId: string,
  days = 7
): Promise<Map<string, number>> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { byRuleKey } = await computeEffectiveness(actorUserId, from, to);
  const map = new Map<string, number>();
  for (const [rk, s] of Object.entries(byRuleKey)) {
    map.set(rk, s.netLiftScore);
  }
  return map;
}
