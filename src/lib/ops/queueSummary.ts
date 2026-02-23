import { db } from "@/lib/db";

export type QueueSummary = {
  new: number;
  enriched: number;
  scored: number;
  positioned: number;
  proposalReady: number;
  approved: number;
  built: number;
};

export async function getQueueSummary(): Promise<QueueSummary> {
  const leads = await db.lead.findMany({
    where: { status: { not: "REJECTED" } },
    select: {
      status: true,
      enrichedAt: true,
      scoredAt: true,
      approvedAt: true,
      buildStartedAt: true,
      artifacts: { select: { type: true, title: true } },
      project: { select: { id: true } },
    },
  });

  const hasEnrich = (a: { type: string; title: string }[]) =>
    a.some((x) => x.type === "notes" && x.title === "AI Enrichment Report");
  const hasPosition = (a: { type: string; title: string }[]) =>
    a.some((x) => x.type === "positioning" && x.title === "POSITIONING_BRIEF");
  const hasProposal = (a: { type: string }[]) => a.some((x) => x.type === "proposal");

  let new_ = 0,
    enriched = 0,
    scored = 0,
    positioned = 0,
    proposalReady = 0,
    approved = 0,
    built = 0;

  for (const l of leads) {
    if (l.status === "NEW") new_++;
    if (hasEnrich(l.artifacts)) enriched++;
    if (l.scoredAt != null) scored++;
    if (hasPosition(l.artifacts)) positioned++;
    if (hasProposal(l.artifacts)) proposalReady++;
    if (l.approvedAt != null) approved++;
    if (l.buildStartedAt != null || l.project) built++;
  }

  return {
    new: new_,
    enriched,
    scored,
    positioned,
    proposalReady,
    approved,
    built,
  };
}
