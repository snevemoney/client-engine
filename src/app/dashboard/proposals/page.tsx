import Link from "next/link";
import { db } from "@/lib/db";
import { ProposalsWorkspace } from "@/components/dashboard/proposals/ProposalsWorkspace";

export const dynamic = "force-dynamic";

export type ProposalRow = {
  leadId: string;
  title: string;
  status: string;
  score: number | null;
  artifactId: string;
  artifactTitle: string;
  proposalContent: string;
  hasResearchSnapshot: boolean;
  proposalSentAt: Date | null;
  dealOutcome: string | null;
};

async function getProposalInbox(): Promise<{
  draft: ProposalRow[];
  approvedNotSent: ProposalRow[];
  sentAwaiting: ProposalRow[];
  won: ProposalRow[];
  lost: ProposalRow[];
}> {
  const leads = await db.lead.findMany({
    where: { status: { not: "REJECTED" } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      artifacts: {
        where: {
          OR: [
            { type: "proposal" },
            { type: "research", title: "RESEARCH_SNAPSHOT" },
          ],
        },
        select: { id: true, type: true, title: true, content: true },
      },
    },
  });

  const draft: ProposalRow[] = [];
  const approvedNotSent: ProposalRow[] = [];
  const sentAwaiting: ProposalRow[] = [];
  const won: ProposalRow[] = [];
  const lost: ProposalRow[] = [];

  for (const lead of leads) {
    const proposal = lead.artifacts.find((a) => a.type === "proposal");
    if (!proposal) continue;

    const hasResearchSnapshot = lead.artifacts.some(
      (a) => a.type === "research" && a.title === "RESEARCH_SNAPSHOT"
    );

    const row: ProposalRow = {
      leadId: lead.id,
      title: lead.title,
      status: lead.status,
      score: lead.score,
      artifactId: proposal.id,
      artifactTitle: proposal.title,
      proposalContent: proposal.content.slice(0, 4000),
      hasResearchSnapshot,
      proposalSentAt: lead.proposalSentAt,
      dealOutcome: lead.dealOutcome,
    };

    if (lead.dealOutcome === "won") won.push(row);
    else if (lead.dealOutcome === "lost") lost.push(row);
    else if (lead.proposalSentAt) sentAwaiting.push(row);
    else if (lead.approvedAt) approvedNotSent.push(row);
    else draft.push(row);
  }

  return { draft, approvedNotSent, sentAwaiting, won, lost };
}

const STALE_DAYS = 7;

async function getFollowUpQueue(sentAwaiting: ProposalRow[]): Promise<{
  needsSequence: ProposalRow[];
  inProgress: ProposalRow[];
  stale: ProposalRow[];
}> {
  if (sentAwaiting.length === 0) return { needsSequence: [], inProgress: [], stale: [] };
  const leadIds = sentAwaiting.map((r) => r.leadId);
  const withSequence = await db.artifact.findMany({
    where: { leadId: { in: leadIds }, type: "FOLLOWUP_SEQUENCE_DRAFT" },
    select: { leadId: true },
  });
  const hasSequenceSet = new Set(withSequence.map((a) => a.leadId));
  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const needsSequence: ProposalRow[] = [];
  const inProgress: ProposalRow[] = [];
  const stale: ProposalRow[] = [];
  for (const row of sentAwaiting) {
    const isStale = row.proposalSentAt && new Date(row.proposalSentAt) < staleCutoff;
    if (isStale) stale.push(row);
    else if (hasSequenceSet.has(row.leadId)) inProgress.push(row);
    else needsSequence.push(row);
  }
  return { needsSequence, inProgress, stale };
}

export default async function ProposalsPage() {
  const buckets = await getProposalInbox();
  const followUpQueue = await getFollowUpQueue(buckets.sentAwaiting);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Proposal workspace: filter, preview, approve, send. Drill down to lead for revise / mark sent / follow-up.
        </p>
      </div>
      <ProposalsWorkspace buckets={buckets} followUpQueue={followUpQueue} />
    </div>
  );
}
