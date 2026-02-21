/**
 * One brain: aggregates "what needs you" for the daily brief.
 * No new infra. Reads leads, artifacts, outcomes. Ranks by upside and urgency.
 * Used by GET /api/brief and the Overview dashboard.
 */

import { db } from "@/lib/db";

export type BriefLead = {
  id: string;
  title: string;
  status: string;
  score: number | null;
  source: string;
  hasProposal: boolean;
  approvedAt: Date | null;
  proposalSentAt: Date | null;
  dealOutcome: string | null;
  createdAt: Date;
};

export type Brief = {
  qualifiedLeads: BriefLead[];
  readyProposals: BriefLead[];
  nextActions: { leadId: string; title: string; action: string }[];
  wins: BriefLead[];
  risks: string[];
  engineOn: boolean;
};

const MIN_SCORE_QUALIFIED = 6;
const MAX_QUALIFIED = 10;
const MAX_READY_PROPOSALS = 10;
const MAX_NEXT_ACTIONS = 10;
const MAX_WINS = 5;

export async function buildBrief(): Promise<Brief> {
  const [leads, recentRuns] = await Promise.all([
    db.lead.findMany({
      where: { status: { not: "REJECTED" } },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        artifacts: { select: { type: true, title: true } },
        project: { select: { id: true } },
      },
    }),
    db.pipelineRun.findMany({
      where: { success: false },
      orderBy: { lastErrorAt: "desc" },
      take: 5,
      select: { leadId: true, lastErrorCode: true, lastErrorAt: true },
    }),
  ]);

  const engineOn =
    process.env.RESEARCH_ENABLED === "1" || process.env.RESEARCH_ENABLED === "true";

  const toBriefLead = (l: (typeof leads)[0]): BriefLead => ({
    id: l.id,
    title: l.title,
    status: l.status,
    score: l.score,
    source: l.source,
    hasProposal: l.artifacts.some((a) => a.type === "proposal"),
    approvedAt: l.approvedAt,
    proposalSentAt: l.proposalSentAt,
    dealOutcome: l.dealOutcome,
    createdAt: l.createdAt,
  });

  const withProposal = leads.filter((l) =>
    l.artifacts.some((a) => a.type === "proposal")
  );
  const qualifiedLeads = leads
    .filter(
      (l) =>
        l.status !== "REJECTED" &&
        (l.score ?? 0) >= MIN_SCORE_QUALIFIED &&
        (l.score ?? 0) <= MAX_QUALIFIED
    )
    .slice(0, MAX_QUALIFIED)
    .map(toBriefLead);

  const readyProposals = withProposal
    .filter(
      (l) =>
        !l.proposalSentAt &&
        l.status !== "REJECTED" &&
        l.artifacts.some((a) => a.type === "proposal")
    )
    .slice(0, MAX_READY_PROPOSALS)
    .map(toBriefLead);

  const nextActions: { leadId: string; title: string; action: string }[] = [];
  for (const l of leads) {
    if (l.status === "APPROVED" && !l.buildStartedAt && !l.project)
      nextActions.push({
        leadId: l.id,
        title: l.title,
        action: "Start build",
      });
    else if (
      l.artifacts.some((a) => a.type === "proposal") &&
      !l.proposalSentAt &&
      l.status !== "REJECTED"
    )
      nextActions.push({
        leadId: l.id,
        title: l.title,
        action: "Review & send proposal",
      });
    if (nextActions.length >= MAX_NEXT_ACTIONS) break;
  }

  const wins = leads
    .filter((l) => l.dealOutcome === "won")
    .slice(0, MAX_WINS)
    .map(toBriefLead);

  const risks: string[] = [];
  for (const r of recentRuns) {
    if (r.lastErrorCode)
      risks.push(`Pipeline error (lead): ${r.lastErrorCode}`);
  }
  const rejectedCount = await db.lead.count({
    where: { status: "REJECTED", updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
  if (rejectedCount > 0) risks.push(`${rejectedCount} lead(s) rejected this week`);

  return {
    qualifiedLeads,
    readyProposals,
    nextActions,
    wins,
    risks: risks.slice(0, 5),
    engineOn,
  };
}
