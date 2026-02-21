/**
 * Pipeline leak report: where leads drop off between stages.
 */

import { db } from "@/lib/db";
import type { PipelineLeakReport } from "./types";

const RECENT_DAYS = 30;
const QUALIFIED_SCORE_MIN = 6;

export async function getPipelineLeakReport(): Promise<PipelineLeakReport> {
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

  const leads = await db.lead.findMany({
    where: { createdAt: { gte: since } },
    select: {
      score: true,
      proposalSentAt: true,
      approvedAt: true,
      buildStartedAt: true,
      dealOutcome: true,
      artifacts: { where: { type: "proposal" }, select: { id: true } },
    },
  });

  const total = leads.length;
  const qualified = leads.filter((l) => (l.score ?? 0) >= QUALIFIED_SCORE_MIN).length;
  const withProposal = leads.filter((l) => l.artifacts.length > 0).length;
  const sent = leads.filter((l) => l.proposalSentAt != null).length;
  const approved = leads.filter((l) => l.approvedAt != null).length;
  const buildStarted = leads.filter((l) => l.buildStartedAt != null).length;
  const won = leads.filter((l) => l.dealOutcome === "won").length;
  const lost = leads.filter((l) => l.dealOutcome === "lost").length;

  const leaks = [
    { fromStage: "Lead", toStage: "Qualified", countIn: total, countOut: qualified },
    { fromStage: "Qualified", toStage: "Proposal", countIn: qualified, countOut: withProposal },
    { fromStage: "Proposal", toStage: "Sent", countIn: withProposal, countOut: sent },
    { fromStage: "Sent", toStage: "Approved", countIn: sent, countOut: approved },
    { fromStage: "Approved", toStage: "Build started", countIn: approved, countOut: buildStarted },
    { fromStage: "Build started", toStage: "Won/Lost", countIn: buildStarted, countOut: won + lost },
  ].map((l) => ({
    ...l,
    pct: l.countIn > 0 ? Math.round((l.countOut / l.countIn) * 100) : 0,
  }));

  const dropOffPcts = leaks.map((l) => ({ stage: `${l.fromStage}→${l.toStage}`, pct: 100 - l.pct }));
  const worst = dropOffPcts.reduce((a, b) => (b.pct > a.pct ? b : a), { stage: "—", pct: 0 });

  return {
    at: new Date().toISOString(),
    worstDropOffStage: worst.stage,
    worstDropOffPct: worst.pct,
    leaks,
  };
}
