/**
 * Phase 2.5: Fetch data for reminder rule generation.
 */

import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "@/lib/operator-score/trends";
import { getStartOfDay } from "@/lib/followup/dates";

export type ReminderRuleInput = {
  now: Date;
  weekStart: Date;
  monthStart: Date;
  startToday: Date;
  proposals: Array<{
    id: string;
    title: string;
    nextFollowUpAt: Date | null;
    sentAt: Date | null;
    respondedAt: Date | null;
    staleAfterDays: number | null;
  }>;
  intakeLeads: Array<{
    id: string;
    title: string;
    nextActionDueAt: Date | null;
    followUpDueAt: Date | null;
    status: string;
  }>;
  wonNoProof: Array<{ id: string; title: string }>;
  proofCandidatesReady: Array<{ id: string; title: string }>;
  deliveryProjects: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    status: string;
    handoffCompletedAt: Date | null;
    clientConfirmedAt: Date | null;
    testimonialRequestedAt: Date | null;
    retentionNextFollowUpAt: Date | null;
  }>;
  completedNoHandoff: number;
  handoffNoClientConfirm: number;
  strategyWeek: { review: { completedAt: Date | null } | null } | null;
  weeklyMetricSnapshot: { id: string } | null;
  operatorScoreSnapshot: { id: string } | null;
  forecastSnapshot: { id: string } | null;
};

export async function fetchReminderRuleInput(now: Date = new Date()): Promise<ReminderRuleInput> {
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);
  const startToday = getStartOfDay(now);
  const endOfWeek = new Date(weekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [
    proposals,
    intakeLeads,
    wonNoProof,
    proofCandidatesReady,
    deliveryProjects,
    completedProjects,
    strategyWeek,
    weeklyMetricSnapshot,
    operatorScoreSnapshot,
    forecastSnapshot,
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
          { nextActionDueAt: { not: null } },
          { followUpDueAt: { not: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        nextActionDueAt: true,
        followUpDueAt: true,
        status: true,
      },
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
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
        testimonialRequestedAt: true,
        retentionNextFollowUpAt: true,
      },
    }),
    db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        handoffStartedAt: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
      },
    }),
    db.strategyWeek.findUnique({
      where: { weekStart },
      include: { review: true },
    }),
    db.weeklyMetricSnapshot.findFirst({ where: { weekStart }, select: { id: true } }),
    db.operatorScoreSnapshot.findFirst({
      where: { periodType: "weekly", periodStart: weekStart },
      select: { id: true },
    }),
    db.forecastSnapshot.findFirst({
      where: { periodType: "weekly", periodStart: weekStart },
      select: { id: true },
    }),
  ]);

  let completedNoHandoff = 0;
  let handoffNoClientConfirm = 0;
  for (const p of completedProjects ?? []) {
    const hasHandoff = !!p.handoffCompletedAt || !!p.handoffStartedAt;
    if (!hasHandoff) completedNoHandoff++;
    else if (!p.clientConfirmedAt) handoffNoClientConfirm++;
  }

  return {
    now,
    weekStart,
    monthStart,
    startToday,
    proposals: proposals ?? [],
    intakeLeads: intakeLeads ?? [],
    wonNoProof: wonNoProof ?? [],
    proofCandidatesReady: proofCandidatesReady ?? [],
    deliveryProjects: deliveryProjects ?? [],
    completedNoHandoff,
    handoffNoClientConfirm,
    strategyWeek,
    weeklyMetricSnapshot,
    operatorScoreSnapshot,
    forecastSnapshot,
  };
}
