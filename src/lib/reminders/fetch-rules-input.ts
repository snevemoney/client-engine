/**
 * Phase 2.5: Fetch data for reminder rules.
 */

import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "@/lib/operator-score/trends";
import { getStartOfDay } from "@/lib/followup/dates";

export type RulesInput = {
  now: Date;
  weekStart: Date;
  monthStart: Date;
  startToday: Date;
  proposalFollowupOverdue: Array<{ id: string; title: string; nextFollowUpAt: Date | null; sentAt: Date | null }>;
  proposalSentNoFollowup: Array<{ id: string; title: string }>;
  proposalStale: Array<{ id: string; title: string }>;
  intakeFollowupOverdue: Array<{ id: string; title: string }>;
  wonNoProof: Array<{ id: string; title: string }>;
  proofReadyPending: Array<{ id: string; title: string }>;
  deliveryOverdue: Array<{ id: string; title: string }>;
  completedNoHandoff: Array<{ id: string; title: string }>;
  handoffNoClientConfirm: Array<{ id: string; title: string }>;
  retentionOverdue: Array<{ id: string; title: string }>;
  weeklyReviewMissing: boolean;
  metricsSnapshotMissing: boolean;
  operatorScoreSnapshotMissing: boolean;
  forecastSnapshotMissing: boolean;
};

export async function fetchRulesInput(now: Date = new Date()): Promise<RulesInput> {
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);
  const startToday = getStartOfDay(now);
  const endOfWeek = new Date(weekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [
    sentProposals,
    intakeLeads,
    wonLeads,
    proofCandidates,
    deliveryProjects,
    completedProjects,
    strategyWeek,
    weeklyMetricSnapshot,
    operatorScoreSnapshot,
    forecastSnapshot,
    retentionProjects,
  ] = await Promise.all([
    db.proposal.findMany({
      where: {
        status: { in: ["sent", "viewed"] },
        acceptedAt: null,
        rejectedAt: null,
      },
      select: {
        id: true,
        title: true,
        nextFollowUpAt: true,
        sentAt: true,
        respondedAt: true,
        staleAfterDays: true,
      },
    }),
    db.intakeLead.findMany({
      where: {
        status: { notIn: ["won", "lost", "archived"] },
        OR: [
          { nextActionDueAt: { lt: startToday } },
          { followUpDueAt: { lt: startToday } },
        ],
      },
      select: { id: true, title: true },
    }),
    db.intakeLead.findMany({
      where: {
        status: "won",
        proofCandidates: { none: {} },
        proofRecords: { none: {} },
      },
      select: { id: true, title: true },
    }),
    db.proofCandidate.findMany({
      where: { status: "ready" },
      select: { id: true, title: true },
    }),
    db.deliveryProject.findMany({
      where: { status: { notIn: ["archived"] } },
      select: { id: true, title: true, dueDate: true },
    }),
    db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        id: true,
        title: true,
        handoffStartedAt: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
        retentionNextFollowUpAt: true,
      },
    }),
    db.strategyWeek.findUnique({
      where: { weekStart },
      include: { review: true },
    }),
    db.weeklyMetricSnapshot.findFirst({ where: { weekStart } }),
    db.operatorScoreSnapshot.findFirst({
      where: { periodType: "weekly", periodStart: weekStart },
    }),
    db.forecastSnapshot.findFirst({
      where: { periodType: "weekly", periodStart: weekStart },
    }),
    db.deliveryProject.findMany({
      where: {
        status: { in: ["completed", "archived"] },
        retentionNextFollowUpAt: { lt: startToday, not: null },
      },
      select: { id: true, title: true },
    }),
  ]);

  const proposalFollowupOverdue: RulesInput["proposalFollowupOverdue"] = [];
  const proposalSentNoFollowup: RulesInput["proposalSentNoFollowup"] = [];
  const proposalStale: RulesInput["proposalStale"] = [];

  for (const p of sentProposals ?? []) {
    if (p.nextFollowUpAt && p.nextFollowUpAt < startToday) {
      proposalFollowupOverdue.push({
        id: p.id,
        title: p.title ?? "Proposal",
        nextFollowUpAt: p.nextFollowUpAt,
        sentAt: p.sentAt,
      });
    } else if (!p.nextFollowUpAt) {
      proposalSentNoFollowup.push({ id: p.id, title: p.title ?? "Proposal" });
    }
    const threshold = p.staleAfterDays ?? 7;
    if (p.sentAt && !p.respondedAt) {
      const daysSince = Math.floor((now.getTime() - p.sentAt.getTime()) / 86400000);
      if (daysSince >= threshold) {
        proposalStale.push({ id: p.id, title: p.title ?? "Proposal" });
      }
    }
  }

  const deliveryOverdue: RulesInput["deliveryOverdue"] = [];
  for (const d of deliveryProjects ?? []) {
    if (d.dueDate && new Date(d.dueDate).getTime() < now.getTime()) {
      deliveryOverdue.push({ id: d.id, title: d.title ?? "Delivery" });
    }
  }

  const completedNoHandoff: RulesInput["completedNoHandoff"] = [];
  const handoffNoClientConfirm: RulesInput["handoffNoClientConfirm"] = [];

  for (const p of completedProjects ?? []) {
    const hasHandoff = !!p.handoffCompletedAt || !!p.handoffStartedAt;
    if (!hasHandoff) {
      completedNoHandoff.push({ id: p.id, title: p.title ?? "Delivery" });
    } else if (!p.clientConfirmedAt) {
      handoffNoClientConfirm.push({ id: p.id, title: p.title ?? "Delivery" });
    }
  }

  return {
    now,
    weekStart,
    monthStart,
    startToday,
    proposalFollowupOverdue,
    proposalSentNoFollowup,
    proposalStale,
    intakeFollowupOverdue: (intakeLeads ?? []).map((l) => ({ id: l.id, title: l.title ?? "Intake" })),
    wonNoProof: (wonLeads ?? []).map((l) => ({ id: l.id, title: l.title ?? "Won lead" })),
    proofReadyPending: (proofCandidates ?? []).map((c) => ({ id: c.id, title: c.title ?? "Proof" })),
    deliveryOverdue,
    completedNoHandoff,
    handoffNoClientConfirm,
    retentionOverdue: (retentionProjects ?? []).map((p) => ({ id: p.id, title: p.title ?? "Retention" })),
    weeklyReviewMissing: !strategyWeek?.review?.completedAt,
    metricsSnapshotMissing: !weeklyMetricSnapshot,
    operatorScoreSnapshotMissing: !operatorScoreSnapshot,
    forecastSnapshotMissing: !forecastSnapshot,
  };
}
