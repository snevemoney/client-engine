/**
 * Money scorecard: hard numbers for executive/PBD-style Q&A.
 * Used by chatbot, metrics, and Command Center.
 */

import { db } from "@/lib/db";
import { getConstraintSnapshot } from "./constraint";
import { getOperatorSettings } from "./settings";
import type { MoneyScorecard } from "./types";

const RECENT_DAYS = 30;
const NINETY_DAYS = 90;
const QUALIFIED_SCORE_MIN = 6;
const DEFAULT_DEAL_SIZE = 12000;
const STALE_DAYS = 7;

function parseBudget(budget: string | null): number | null {
  if (!budget) return null;
  const n = parseFloat(budget.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

export async function getMoneyScorecard(): Promise<MoneyScorecard> {
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const since90d = new Date(Date.now() - NINETY_DAYS * 24 * 60 * 60 * 1000);

  const [leads, dealsWon90dCount] = await Promise.all([
  db.lead.findMany({
    where: { createdAt: { gte: since } },
    select: {
      score: true,
      budget: true,
      proposalSentAt: true,
      approvedAt: true,
      buildStartedAt: true,
      buildCompletedAt: true,
      dealOutcome: true,
      createdAt: true,
      updatedAt: true,
      artifacts: { where: { type: "proposal" }, select: { id: true } },
    },
  }),
  db.lead.count({
    where: {
      dealOutcome: "won",
      updatedAt: { gte: since90d },
    },
  }),
  ]);

  const qualified = leads.filter((l) => (l.score ?? 0) >= QUALIFIED_SCORE_MIN);
  const withProposal = leads.filter((l) => l.artifacts.length > 0);
  const sent = leads.filter((l) => l.proposalSentAt != null);
  const won = leads.filter((l) => l.dealOutcome === "won");
  const lost = leads.filter((l) => l.dealOutcome === "lost");

  const dealSizes = won.map((l) => parseBudget(l.budget)).filter((n): n is number => n != null);
  const avgDealSize =
    dealSizes.length > 0
      ? Math.round(dealSizes.reduce((a, b) => a + b, 0) / dealSizes.length)
      : null;

  const createdToSent = sent
    .filter((l) => l.proposalSentAt && l.createdAt)
    .map((l) => +new Date(l.proposalSentAt!) - +new Date(l.createdAt));
  const timeToProposalMedianDays =
    createdToSent.length > 0
      ? Math.round(
          (createdToSent.sort((a, b) => a - b)[Math.floor(createdToSent.length / 2)]! / (24 * 60 * 60 * 1000)) * 10
        ) / 10
      : null;

  const sentToOutcome = [...won, ...lost].filter((l) => l.proposalSentAt && l.updatedAt);
  const timeToCloseMs = sentToOutcome.map(
    (l) => +new Date(l.updatedAt!) - +new Date(l.proposalSentAt!)
  );
  const timeToCloseMedianDays =
    timeToCloseMs.length > 0
      ? Math.round(
          (timeToCloseMs.sort((a, b) => a - b)[Math.floor(timeToCloseMs.length / 2)]! / (24 * 60 * 60 * 1000)) * 10
        ) / 10
      : null;

  const pipelineValueEstimate =
    qualified.length * (avgDealSize ?? DEFAULT_DEAL_SIZE) * 0.1 +
    sent.length * (avgDealSize ?? DEFAULT_DEAL_SIZE) * 0.25;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const newLeadsToday = leads.filter((l) => new Date(l.createdAt) >= todayStart).length;
  const newLeads7d = leads.filter((l) => new Date(l.createdAt) >= sevenDaysAgo).length;
  const qualified7d = leads.filter(
    (l) => (l.score ?? 0) >= QUALIFIED_SCORE_MIN && (new Date(l.createdAt) >= sevenDaysAgo || (l.updatedAt && new Date(l.updatedAt) >= sevenDaysAgo))
  ).length;
  const proposalsSent7d = sent.filter((l) => l.proposalSentAt && new Date(l.proposalSentAt) >= sevenDaysAgo).length;
  const sentNoOutcome = leads.filter((l) => l.proposalSentAt && !l.dealOutcome);
  const followUpsDueToday = await db.lead.count({
    where: {
      status: { not: "REJECTED" },
      dealOutcome: { not: "won" },
      nextContactAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });
  const staleOpportunitiesCount = sentNoOutcome.filter(
    (l) => l.proposalSentAt && new Date(l.proposalSentAt) < staleCutoff
  ).length;
  const revenueWon30d = won.reduce((sum, l) => sum + (parseBudget(l.budget) ?? 0), 0) || null;

  const [constraint, operatorSettings] = await Promise.all([
    getConstraintSnapshot(),
    getOperatorSettings(),
  ]);
  const primaryBottleneck = constraint ? `${constraint.label}: ${constraint.reason}` : null;
  const constraintImpactNote = constraint
    ? `Improving ${constraint.label.toLowerCase()} should increase throughput and reduce lead decay.`
    : null;

  return {
    at: new Date().toISOString(),
    leadsDiscovered: leads.length,
    leadsQualified: qualified.length,
    proposalsDrafted: withProposal.length,
    proposalsSent: sent.length,
    dealsWon: won.length,
    dealsLost: lost.length,
    pipelineValueEstimate: Math.round(pipelineValueEstimate),
    avgDealSizeEstimate: avgDealSize,
    timeToProposalMedianDays,
    timeToCloseMedianDays,
    cashCollected: operatorSettings.cashCollected ?? null,
    newLeadsToday,
    newLeads7d,
    qualifiedLeads7d: qualified7d,
    proposalsSent7d,
    followUpsDueToday,
    callsBooked: null,
    revenueWon30d,
    dealsWon90d: dealsWon90dCount,
    staleOpportunitiesCount,
    primaryBottleneck,
    constraintImpactNote,
  };
}
