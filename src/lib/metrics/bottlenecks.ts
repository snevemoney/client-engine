/**
 * Phase 2.3: Bottleneck aggregation from command-center style data.
 * Returns { key, label, count, severity, href }[].
 */

import { db } from "@/lib/db";
import { getStartOfDay } from "@/lib/followup/dates";

export type BottleneckItem = {
  key: string;
  label: string;
  count: number;
  severity: "low" | "medium" | "high";
  href: string;
};

export async function fetchBottlenecks(): Promise<BottleneckItem[]> {
  const now = new Date();
  const startToday = getStartOfDay(now);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [
    readyNotSent,
    sentProposals,
    sentNoResponseOver7d,
    acceptedNoProject,
    deliveryProjects,
    completedProjects,
    proofCandidatesReady,
    wonMissingProof,
  ] = await Promise.all([
    db.proposal.count({ where: { status: "ready" } }),
    db.proposal.findMany({
      where: {
        status: { in: ["sent", "viewed"] },
        acceptedAt: null,
        rejectedAt: null,
      },
      select: {
        id: true,
        nextFollowUpAt: true,
        sentAt: true,
        respondedAt: true,
        staleAfterDays: true,
      },
    }),
    db.proposal.count({
      where: {
        status: "sent",
        sentAt: { lt: weekAgo },
        respondedAt: null,
      },
    }),
    db.proposal.count({
      where: { status: "accepted", deliveryProjects: { none: {} } },
    }),
    db.deliveryProject.findMany({
      where: { status: { notIn: ["archived"] } },
      select: { status: true, dueDate: true, handoffStartedAt: true, handoffCompletedAt: true, clientConfirmedAt: true, testimonialRequestedAt: true, proofCandidateId: true },
    }),
    db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        handoffStartedAt: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
        testimonialRequestedAt: true,
        proofCandidateId: true,
      },
    }),
    db.proofCandidate.count({ where: { status: "ready" } }),
    (async () => {
      const [intakeWon, pipelineWon] = await Promise.all([
        db.intakeLead.count({
          where: {
            status: "won",
            proofCandidates: { none: {} },
            proofRecords: { none: {} },
          },
        }),
        db.lead.count({
          where: {
            dealOutcome: "won",
            proofCandidates: { none: {} },
          },
        }),
      ]);
      return (intakeWon ?? 0) + (pipelineWon ?? 0);
    })(),
  ]);

  let sentNoFollowup = 0;
  let stale = 0;
  for (const p of sentProposals ?? []) {
    if (!p.nextFollowUpAt) sentNoFollowup++;
    const threshold = p.staleAfterDays ?? 7;
    if (p.sentAt && !p.respondedAt) {
      const daysSince = Math.floor((now.getTime() - p.sentAt.getTime()) / 86400000);
      if (daysSince >= threshold) stale++;
    }
  }

  const msPerDay = 86400000;
  let deliveryOverdue = 0;
  for (const p of deliveryProjects ?? []) {
    if (p.dueDate && new Date(p.dueDate).getTime() < now.getTime()) deliveryOverdue++;
  }

  let completedNoHandoff = 0;
  let handoffNoClientConfirm = 0;
  let completedNoTestimonialRequest = 0;
  let completedNoProof = 0;
  for (const p of completedProjects ?? []) {
    const hasHandoff = !!p.handoffCompletedAt || !!p.handoffStartedAt;
    if (!hasHandoff) completedNoHandoff++;
    else if (!p.clientConfirmedAt) handoffNoClientConfirm++;
    if (!p.testimonialRequestedAt) completedNoTestimonialRequest++;
    if (!p.proofCandidateId) completedNoProof++;
  }

  const items: BottleneckItem[] = [];

  if ((readyNotSent ?? 0) > 0) {
    items.push({
      key: "proposals_ready_not_sent",
      label: "Proposals ready not sent",
      count: readyNotSent ?? 0,
      severity: "high",
      href: "/dashboard/proposals?status=ready",
    });
  }
  if (sentNoFollowup > 0) {
    items.push({
      key: "sent_no_followup",
      label: "Sent proposals with no follow-up date",
      count: sentNoFollowup,
      severity: "high",
      href: "/dashboard/proposal-followups",
    });
  }
  if (stale > 0) {
    items.push({
      key: "proposals_stale",
      label: "Proposals stale (no response)",
      count: stale,
      severity: "high",
      href: "/dashboard/proposal-followups",
    });
  }
  if ((acceptedNoProject ?? 0) > 0) {
    items.push({
      key: "accepted_no_project",
      label: "Accepted proposals with no delivery project",
      count: acceptedNoProject ?? 0,
      severity: "high",
      href: "/dashboard/proposals?status=accepted",
    });
  }
  if (deliveryOverdue > 0) {
    items.push({
      key: "delivery_overdue",
      label: "Delivery projects overdue",
      count: deliveryOverdue,
      severity: "high",
      href: "/dashboard/delivery",
    });
  }
  if (completedNoHandoff > 0) {
    items.push({
      key: "completed_no_handoff",
      label: "Completed projects with no handoff",
      count: completedNoHandoff,
      severity: "medium",
      href: "/dashboard/handoffs",
    });
  }
  if (handoffNoClientConfirm > 0) {
    items.push({
      key: "handoff_no_client_confirm",
      label: "Handoff done, awaiting client confirm",
      count: handoffNoClientConfirm,
      severity: "medium",
      href: "/dashboard/handoffs",
    });
  }
  if (completedNoTestimonialRequest > 0) {
    items.push({
      key: "completed_no_testimonial_request",
      label: "Completed projects, testimonial not requested",
      count: completedNoTestimonialRequest,
      severity: "low",
      href: "/dashboard/reviews",
    });
  }
  if ((proofCandidatesReady ?? 0) > 0) {
    items.push({
      key: "proof_candidates_ready_pending",
      label: "Proof candidates ready, pending promotion",
      count: proofCandidatesReady ?? 0,
      severity: "medium",
      href: "/dashboard/proof",
    });
  }
  if (wonMissingProof > 0) {
    items.push({
      key: "won_missing_proof",
      label: "Won deals missing proof",
      count: wonMissingProof,
      severity: "medium",
      href: "/dashboard/proof",
    });
  }

  return items;
}
