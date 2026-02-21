/**
 * Deterministic constraint/bottleneck detector from pipeline and lead stage data.
 * Surfaces the single highest-friction stage with evidence and recommended actions.
 */

import { db } from "@/lib/db";
import type { ConstraintSnapshot } from "./types";

const CONSTRAINT_KEYS = [
  "research_intake",
  "enrichment",
  "scoring",
  "positioning",
  "proposal_generation",
  "proposal_approval",
  "build_execution",
  "delivery_outcomes",
] as const;

const STAGE_LABELS: Record<string, string> = {
  research_intake: "Research intake",
  enrichment: "Enrichment",
  scoring: "Scoring",
  positioning: "Positioning",
  proposal_generation: "Proposal generation",
  proposal_approval: "Proposal approval",
  build_execution: "Build execution",
  delivery_outcomes: "Delivery / outcomes",
};

const MAX_LEADS_ANALYZED = 500;
const RECENT_DAYS = 14;

export async function getConstraintSnapshot(): Promise<ConstraintSnapshot | null> {
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

  const [leads, stepStats, failedRunsWithSteps] = await Promise.all([
    db.lead.findMany({
      where: { createdAt: { gte: since } },
      select: {
        status: true,
        enrichedAt: true,
        scoredAt: true,
        approvedAt: true,
        buildStartedAt: true,
        buildCompletedAt: true,
        dealOutcome: true,
        artifacts: { select: { type: true, title: true } },
        project: { select: { id: true } },
      },
      take: MAX_LEADS_ANALYZED,
    }),
    db.pipelineStepRun.groupBy({
      by: ["stepName", "success"],
      where: {
        run: { startedAt: { gte: since } },
      },
      _count: true,
    }),
    db.pipelineRun.findMany({
      where: { success: false, startedAt: { gte: since } },
      select: { id: true, steps: { where: { success: false }, select: { stepName: true } } },
      take: 100,
    }),
  ]);

  const total = leads.length;
  if (total === 0) return null;

  const withEnrich = leads.filter((l) =>
    l.artifacts.some((a) => a.type === "notes" && a.title === "AI Enrichment Report")
  );
  const withScore = leads.filter((l) => l.scoredAt != null);
  const withPosition = leads.filter((l) =>
    l.artifacts.some((a) => a.type === "positioning" && a.title === "POSITIONING_BRIEF")
  );
  const withProposal = leads.filter((l) => l.artifacts.some((a) => a.type === "proposal"));
  const approved = leads.filter((l) => l.approvedAt != null);
  const buildStarted = leads.filter((l) => l.buildStartedAt != null);
  const buildCompleted = leads.filter((l) => l.buildCompletedAt != null);
  const withOutcome = leads.filter((l) => l.dealOutcome === "won" || l.dealOutcome === "lost");

  const byStep: Record<string, { total: number; ok: number }> = {};
  for (const { stepName, success, _count } of stepStats) {
    if (!byStep[stepName]) byStep[stepName] = { total: 0, ok: 0 };
    byStep[stepName].total += _count;
    if (success) byStep[stepName].ok += _count;
  }

  const failureByStepCorrect: Record<string, number> = {};
  for (const run of failedRunsWithSteps) {
    for (const s of run.steps) {
      failureByStepCorrect[s.stepName] = (failureByStepCorrect[s.stepName] ?? 0) + 1;
    }
  }

  // Stage funnel counts (output side)
  const nNew = leads.filter((l) => l.status === "NEW").length;
  const nEnriched = withEnrich.length;
  const nScored = withScore.length;
  const nPositioned = withPosition.length;
  const nProposal = withProposal.length;
  const nApproved = approved.length;
  const nBuildStarted = buildStarted.length;
  const nBuildCompleted = buildCompleted.length;
  const nOutcome = withOutcome.length;

  // Drop-off ratios and accumulation
  const candidates: { key: (typeof CONSTRAINT_KEYS)[number]; score: number; evidence: Record<string, number | string>; reason: string; actions: string[] }[] = [];

  // Research: low creation vs expectation (we don't have "discovered" here, so skip or use lead creation rate)
  candidates.push({
    key: "research_intake",
    score: total < 5 ? 100 : 0,
    evidence: { leadsCreated: total },
    reason: total < 5 ? "Few leads created recently; research or intake may be the limit." : "",
    actions: ["Check RESEARCH_ENABLED and feed config.", "Run research manually and check logs."],
  });

  // Enrichment: many NEW, few enriched
  const enrichRate = total ? nEnriched / total : 0;
  candidates.push({
    key: "enrichment",
    score: nNew > nEnriched ? 80 + (1 - enrichRate) * 20 : 30,
    evidence: { new: nNew, enriched: nEnriched, total, failureCount: failureByStepCorrect["enrich"] ?? 0 },
    reason:
      nEnriched < total * 0.5 && total >= 5
        ? "Leads are piling at enrichment; step may be failing or slow."
        : "Enrichment throughput is acceptable.",
    actions: ["Check pipeline run errors for enrich step.", "Retry failed leads."],
  });

  // Scoring
  const scoreRate = total ? nScored / total : 0;
  candidates.push({
    key: "scoring",
    score: nEnriched > nScored ? 70 + (1 - scoreRate) * 20 : 25,
    evidence: { enriched: nEnriched, scored: nScored, failureCount: failureByStepCorrect["score"] ?? 0 },
    reason:
      nScored < nEnriched * 0.8 && nEnriched >= 3
        ? "Enriched leads not moving to scored; scoring may be the constraint."
        : "Scoring is keeping up.",
    actions: ["Review score step failures.", "Retry leads stuck after enrich."],
  });

  // Positioning
  candidates.push({
    key: "positioning",
    score: nScored > nPositioned ? 70 : 20,
    evidence: { scored: nScored, positioned: nPositioned, failureCount: failureByStepCorrect["position"] ?? 0 },
    reason:
      nPositioned < nScored * 0.8 && nScored >= 2
        ? "Positioning step is the bottleneck."
        : "Positioning throughput OK.",
    actions: ["Check position step errors.", "Retry failed runs."],
  });

  // Proposal generation
  candidates.push({
    key: "proposal_generation",
    score: nPositioned > nProposal ? 70 : 20,
    evidence: { positioned: nPositioned, withProposal: nProposal, failureCount: failureByStepCorrect["propose"] ?? 0 },
    reason:
      nProposal < nPositioned * 0.8 && nPositioned >= 2
        ? "Proposals not being generated; propose step may be failing."
        : "Proposal generation OK.",
    actions: ["Check propose step errors.", "Ensure positioning brief exists for leads."],
  });

  // Proposal approval (human)
  candidates.push({
    key: "proposal_approval",
    score: nProposal > 0 && nApproved < nProposal ? 85 : 15,
    evidence: { proposalsReady: nProposal, approved: nApproved },
    reason:
      nApproved < nProposal && nProposal >= 1
        ? "Proposals are ready but not approved; your review is the constraint."
        : "No backlog at approval.",
    actions: ["Review and approve proposals in dashboard.", "Send approved proposals."],
  });

  // Build execution
  candidates.push({
    key: "build_execution",
    score: nApproved > nBuildStarted ? 80 : 15,
    evidence: { approved: nApproved, buildStarted: nBuildStarted, buildCompleted: nBuildCompleted },
    reason:
      nBuildStarted < nApproved && nApproved >= 1
        ? "Approved leads not started; build execution is the constraint."
        : "Builds moving.",
    actions: ["Start build for approved leads.", "Check build step errors."],
  });

  // Delivery outcomes
  candidates.push({
    key: "delivery_outcomes",
    score: nBuildCompleted > 0 && nOutcome < nBuildCompleted ? 60 : 10,
    evidence: { buildCompleted: nBuildCompleted, withOutcome: nOutcome },
    reason:
      nBuildCompleted >= 1 && nOutcome < nBuildCompleted
        ? "Builds completed but outcomes not recorded; close the loop."
        : "Outcomes tracked or no builds yet.",
    actions: ["Mark deal outcomes (won/lost) on completed builds.", "Add delivery proof."],
  });

  const sorted = candidates
    .filter((c) => c.score >= 20)
    .sort((a, b) => b.score - a.score);
  const top = sorted[0];
  if (!top) return null;

  return {
    constraintKey: top.key,
    label: STAGE_LABELS[top.key] ?? top.key,
    reason: top.reason,
    evidence: top.evidence,
    recommendedActions: top.actions.slice(0, 3),
  };
}

export async function detectPrimaryConstraint(): Promise<ConstraintSnapshot | null> {
  return getConstraintSnapshot();
}
