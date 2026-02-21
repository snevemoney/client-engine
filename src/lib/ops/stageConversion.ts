/**
 * Stage conversion rates for advisor-style answers.
 */

import { db } from "@/lib/db";
import type { StageConversion } from "./types";

const RECENT_DAYS = 30;
const QUALIFIED_SCORE_MIN = 6;

export async function getStageConversion(): Promise<StageConversion> {
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

  return {
    at: new Date().toISOString(),
    leadToQualifiedPct: total ? Math.round((qualified / total) * 100) : 0,
    qualifiedToProposalPct: qualified ? Math.round((withProposal / qualified) * 100) : 0,
    proposalToSentPct: withProposal ? Math.round((sent / withProposal) * 100) : 0,
    sentToReplyPct: null,
    sentToWonPct: sent ? Math.round((won / sent) * 100) : 0,
    sentToLostPct: sent ? Math.round((lost / sent) * 100) : 0,
    approvalToBuildPct: approved ? Math.round((buildStarted / approved) * 100) : 0,
  };
}
