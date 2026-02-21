/**
 * Top leads by signal (score, recency, proposal readiness) for executive brief and chat.
 */

import { db } from "@/lib/db";

const QUALIFIED_SCORE_MIN = 6;
const MAX_LEADS = 10;

export type TopLeadRow = {
  id: string;
  title: string;
  score: number | null;
  status: string;
  hasProposal: boolean;
  approvedAt: Date | null;
  proposalSentAt: Date | null;
  source: string;
};

export async function getTopLeadsBySignal(): Promise<TopLeadRow[]> {
  const leads = await db.lead.findMany({
    where: { status: { not: "REJECTED" } },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: MAX_LEADS * 2,
    select: {
      id: true,
      title: true,
      score: true,
      status: true,
      approvedAt: true,
      proposalSentAt: true,
      source: true,
      artifacts: { where: { type: "proposal" }, select: { id: true } },
    },
  });

  return leads
    .map((l) => ({
      id: l.id,
      title: l.title,
      score: l.score,
      status: l.status,
      hasProposal: l.artifacts.length > 0,
      approvedAt: l.approvedAt,
      proposalSentAt: l.proposalSentAt,
      source: l.source,
    }))
    .slice(0, MAX_LEADS);
}
