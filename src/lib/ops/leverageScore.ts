/**
 * Leverage Score (0–100): single number for "real operator system vs advanced dashboard."
 * Used weekly with Production Criticism Checklist. See docs/LEVERAGE_SCORE.md.
 */

import { db } from "@/lib/db";
import { ARTIFACT_TYPES } from "@/lib/client-success/types";
import { LEARNING_ARTIFACT_TYPES } from "@/lib/learning/types";

const WEIGHTS = {
  reusableAsset: 0.25,
  outcomesTracked: 0.25,
  learningAction: 0.2,
  failureVisibility: 0.15,
  proposalWinRate: 0.15,
} as const;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type LeverageScoreComponents = {
  reusableAssetPct: number;
  outcomesTrackedPct: number;
  learningActionPct: number;
  failureVisibilityScore: number;
  proposalWinRatePct: number | null;
};

export type LeverageScoreResult = {
  score: number;
  at: string;
  components: LeverageScoreComponents;
};

export async function getLeverageScore(): Promise<LeverageScoreResult> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - NINETY_DAYS_MS);
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

  const [
    deliveryLeads,
    leadsWithReusableAsset,
    leadsWithOutcomes,
    learningLead,
    lastWorkdayRun,
    dealOutcomes,
  ] = await Promise.all([
    db.lead.count({
      where: { status: { in: ["APPROVED", "BUILDING", "SHIPPED"] } },
    }),
    db.lead.count({
      where: {
        status: { in: ["APPROVED", "BUILDING", "SHIPPED"] },
        artifacts: {
          some: { type: ARTIFACT_TYPES.REUSABLE_ASSET_LOG },
        },
      },
    }),
    db.lead.count({
      where: {
        status: { in: ["APPROVED", "BUILDING", "SHIPPED"] },
        artifacts: {
          some: {
            type: { in: [ARTIFACT_TYPES.RESULT_TARGET, ARTIFACT_TYPES.BASELINE_SNAPSHOT, ARTIFACT_TYPES.OUTCOME_SCORECARD] },
          },
        },
      },
    }),
    db.lead.findFirst({
      where: { source: "system", title: "Learning Engine Runs" },
      select: { id: true },
    }),
    db.artifact.findFirst({
      where: {
        lead: { source: "system", title: "Research Engine Runs" },
        title: "WORKDAY_RUN_REPORT",
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.lead.findMany({
      where: {
        proposalSentAt: { not: null, gte: ninetyDaysAgo },
        dealOutcome: { in: ["won", "lost"] },
      },
      select: { dealOutcome: true },
    }),
  ]);

  const reusableAssetPct =
    deliveryLeads > 0 ? Math.round((leadsWithReusableAsset / deliveryLeads) * 100) : 0;
  const outcomesTrackedPct =
    deliveryLeads > 0 ? Math.round((leadsWithOutcomes / deliveryLeads) * 100) : 0;

  let learningActionPct = 0;
  if (learningLead) {
    const proposals = await db.artifact.findMany({
      where: {
        leadId: learningLead.id,
        type: LEARNING_ARTIFACT_TYPES.ENGINE_IMPROVEMENT_PROPOSAL,
      },
      select: { meta: true },
    });
    const total = proposals.length;
    const actionCount = proposals.filter((p) => {
      const m = p.meta as Record<string, unknown> | null;
      if (!m) return false;
      if (m.promotedToPlaybook === true) return true;
      const produced = m.producedAssetType as string | undefined;
      return produced && produced !== "knowledge_only";
    }).length;
    learningActionPct = total > 0 ? Math.round((actionCount / total) * 100) : 0;
  }

  const failureVisibilityScore =
    lastWorkdayRun && new Date(lastWorkdayRun.createdAt) >= sevenDaysAgo ? 100 : 50;

  let proposalWinRatePct: number | null = null;
  const won = dealOutcomes.filter((l) => l.dealOutcome === "won").length;
  const lost = dealOutcomes.filter((l) => l.dealOutcome === "lost").length;
  if (won + lost > 0) {
    proposalWinRatePct = Math.round((won / (won + lost)) * 100);
  }

  const winRateComponent = proposalWinRatePct ?? 50;
  const score = Math.min(
    100,
    Math.round(
      reusableAssetPct * WEIGHTS.reusableAsset +
        outcomesTrackedPct * WEIGHTS.outcomesTracked +
        learningActionPct * WEIGHTS.learningAction +
        failureVisibilityScore * WEIGHTS.failureVisibility +
        winRateComponent * WEIGHTS.proposalWinRate
    )
  );

  return {
    score,
    at: now.toISOString(),
    components: {
      reusableAssetPct,
      outcomesTrackedPct,
      learningActionPct,
      failureVisibilityScore,
      proposalWinRatePct,
    },
  };
}
