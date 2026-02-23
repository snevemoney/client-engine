/**
 * Failures & Interventions: single source for "what broke, what's stuck, what needs you."
 * Feeds the Command Center card so operator sees everything at a glance (autopilot guardrail).
 */

import { db } from "@/lib/db";

const STALE_PROPOSAL_SENT_DAYS = 7;
const STUCK_PROPOSAL_DAYS = 5; // has proposal, not sent, sitting > N days

export type FailedRunItem = {
  leadId: string;
  leadTitle: string;
  runId: string;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
};

export type StaleLeadItem = {
  leadId: string;
  leadTitle: string;
  proposalSentAt: string;
  daysSinceSent: number;
};

export type StuckProposalItem = {
  leadId: string;
  leadTitle: string;
  proposalReadyAt: string; // artifact createdAt of latest proposal
  daysStuck: number;
};

export type NeedsApprovalItem = {
  leadId: string;
  leadTitle: string;
  action: string; // "Review & send proposal" | "Start build"
};

export type FailuresAndInterventions = {
  failedPipelineRuns: FailedRunItem[];
  staleLeads: StaleLeadItem[];
  stuckProposals: StuckProposalItem[];
  needsApproval: NeedsApprovalItem[];
  totalCount: number;
};

export async function getFailuresAndInterventions(): Promise<FailuresAndInterventions> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_PROPOSAL_SENT_DAYS * 24 * 60 * 60 * 1000);
  const stuckCutoff = new Date(now.getTime() - STUCK_PROPOSAL_DAYS * 24 * 60 * 60 * 1000);

  const [failedRuns, sentNoOutcome, leadsWithProposalNotSent, approvedNotBuilding] = await Promise.all([
    db.pipelineRun.findMany({
      where: { success: false },
      orderBy: { lastErrorAt: "desc" },
      take: 15,
      include: { lead: { select: { title: true } } },
    }),
    db.lead.findMany({
      where: {
        proposalSentAt: { not: null, lt: staleCutoff },
        dealOutcome: null,
        status: { not: "REJECTED" },
      },
      take: 100,
      select: { id: true, title: true, proposalSentAt: true },
    }),
    db.lead.findMany({
      where: {
        status: { not: "REJECTED" },
        proposalSentAt: null,
        artifacts: {
          some: { type: "proposal" },
        },
      },
      take: 100,
      select: {
        id: true,
        title: true,
        artifacts: {
          where: { type: "proposal" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    db.lead.findMany({
      where: {
        status: "APPROVED",
        buildStartedAt: null,
        project: null,
      },
      take: 50,
      select: { id: true, title: true },
    }),
  ]);
  const readyProposals = leadsWithProposalNotSent;

  const failedPipelineRuns: FailedRunItem[] = failedRuns.map((r) => ({
    leadId: r.leadId,
    leadTitle: r.lead.title,
    runId: r.id,
    lastErrorCode: r.lastErrorCode,
    lastErrorAt: r.lastErrorAt?.toISOString() ?? null,
  }));

  const staleLeads: StaleLeadItem[] = sentNoOutcome.map((l) => ({
    leadId: l.id,
    leadTitle: l.title,
    proposalSentAt: l.proposalSentAt!.toISOString(),
    daysSinceSent: Math.floor(
      (now.getTime() - new Date(l.proposalSentAt!).getTime()) / (24 * 60 * 60 * 1000)
    ),
  }));

  const stuckProposals: StuckProposalItem[] = leadsWithProposalNotSent
    .filter((l) => {
      const created = l.artifacts[0]?.createdAt;
      return created && new Date(created) < stuckCutoff;
    })
    .map((l) => {
      const created = l.artifacts[0]!.createdAt;
      return {
        leadId: l.id,
        leadTitle: l.title,
        proposalReadyAt: new Date(created).toISOString(),
        daysStuck: Math.floor(
          (now.getTime() - new Date(created).getTime()) / (24 * 60 * 60 * 1000)
        ),
      };
    });

  const needsApproval: NeedsApprovalItem[] = [
    ...readyProposals.slice(0, 10).map((l) => ({
      leadId: l.id,
      leadTitle: l.title,
      action: "Review & send proposal" as const,
    })),
    ...approvedNotBuilding.map((l) => ({
      leadId: l.id,
      leadTitle: l.title,
      action: "Start build" as const,
    })),
  ];

  const totalCount =
    failedPipelineRuns.length +
    staleLeads.length +
    stuckProposals.length +
    needsApproval.length;

  return {
    failedPipelineRuns,
    staleLeads,
    stuckProposals,
    needsApproval,
    totalCount,
  };
}
