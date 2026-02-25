/**
 * Phase 3.1: Fetch context for score adapters.
 * Server-side only — uses db directly.
 */

import { db } from "@/lib/db";
import { IntakeLeadStatus, ProofCandidateStatus } from "@prisma/client";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getStartOfDay, getEndOfDay } from "@/lib/followup/dates";
import type { ReviewsAdapterContext } from "./adapters/reviews";
import type { CommandCenterContext } from "./adapters/command-center";

/** Parse entityId for review_stream: ISO date string (weekStart). */
function parseWeekStart(entityId: string): Date {
  const d = new Date(entityId);
  if (isNaN(d.getTime())) throw new Error(`Invalid weekStart: ${entityId}`);
  return d;
}

/** Fetch context for review_stream adapter. */
export async function fetchReviewsContext(entityId: string): Promise<ReviewsAdapterContext | null> {
  const weekStart = parseWeekStart(entityId);
  const strategyWeek = await db.strategyWeek.findUnique({
    where: { weekStart },
    include: {
      review: true,
      priorities: true,
      risks: true,
    },
  });

  if (!strategyWeek) return null;

  const review = strategyWeek.review;
  const priorities = strategyWeek.priorities ?? [];
  const risks = strategyWeek.risks ?? [];
  const prioritiesDone = priorities.filter((p) => p.status === "done").length;
  const risksOpen = risks.filter((r) => r.status === "open").length;

  return {
    weekStart,
    reviewCompleted: !!review?.completedAt,
    reviewScore: review?.score ?? null,
    campaignShipped: review?.campaignShipped ?? false,
    systemImproved: review?.systemImproved ?? false,
    salesActionsDone: review?.salesActionsDone ?? false,
    proofCaptured: review?.proofCaptured ?? false,
    prioritiesTotal: priorities.length || 1,
    prioritiesDone,
    risksOpen,
  };
}

/** Fetch context for command_center adapter. */
export async function fetchCommandCenterContext(): Promise<CommandCenterContext> {
  const now = new Date();
  const startToday = getStartOfDay(now);
  const endToday = getEndOfDay(now);
  const weekStart = getWeekStart(now);
  const endOfWeek = new Date(weekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const intakeWhere = { status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost] } };

  const [
    followupCounts,
    actionSummary,
    proofGaps,
    integrations,
    jobsSummary,
    observability,
    remindersResult,
  ] = await Promise.all([
    Promise.all([
      db.intakeLead.count({
        where: {
          ...intakeWhere,
          OR: [
            { nextActionDueAt: { lt: startToday } },
            { followUpDueAt: { lt: startToday } },
          ],
        },
      }),
        db.intakeLead.count({
          where: {
            ...intakeWhere,
            OR: [
              {
                AND: [
                  { nextActionDueAt: { gte: startToday } },
                  { nextActionDueAt: { lte: endToday } },
                ],
              },
              {
                AND: [
                  { followUpDueAt: { gte: startToday } },
                  { followUpDueAt: { lte: endToday } },
                ],
              },
            ],
          },
        }),
        db.intakeLead.count({
          where: {
            ...intakeWhere,
            OR: [
              { nextActionDueAt: { gt: endToday } },
              { followUpDueAt: { gt: endToday } },
            ],
          },
        }),
    ]),
    Promise.all([
      db.intakeLead.count({
        where: {
          status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost, IntakeLeadStatus.archived] },
          score: null,
        },
      }),
      db.intakeLead.count({
        where: {
          status: { in: ["qualified", "proposal_drafted"] },
          promotedLeadId: null,
          title: { not: "" },
          summary: { not: "" },
        },
      }),
      db.intakeLead.count({
        where: {
          promotedLeadId: { not: null },
          nextActionDueAt: null,
          followUpDueAt: null,
          status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost] },
        },
      }),
      db.intakeLead.count({
        where: {
          status: "sent",
          OR: [
            { followUpDueAt: { lt: startToday } },
            { nextActionDueAt: { lt: startToday } },
          ],
        },
      }),
      db.intakeLead.count({
        where: {
          status: "won",
          proofCandidates: { none: {} },
          proofRecords: { none: {} },
        },
      }),
    ]),
    Promise.all([
      db.intakeLead.count({
        where: {
          status: "won",
          proofCandidates: { none: {} },
          proofRecords: { none: {} },
        },
      }),
      db.proofCandidate.count({ where: { status: ProofCandidateStatus.ready } }),
      db.proofRecord.count({
        where: {
          OR: [
            { proofSnippet: null },
            { proofSnippet: "" },
            { afterState: null },
            { afterState: "" },
          ],
        },
      }),
      db.proofCandidate.count({
        where: {
          status: ProofCandidateStatus.promoted,
          promotedAt: { gte: weekStart, lte: endOfWeek },
        },
      }),
    ]),
    db.integrationConnection.findMany({
      where: { isEnabled: true },
      select: { status: true },
    }),
    (async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
      const [queued, running, failed, deadLetter, staleRunning, dueSchedules] = await Promise.all([
        db.jobRun.count({ where: { status: "queued" } }),
        db.jobRun.count({ where: { status: "running" } }),
        db.jobRun.count({ where: { status: "failed" } }),
        db.jobRun.count({ where: { status: "dead_letter" } }),
        db.jobRun.count({
          where: {
            status: "running",
            OR: [
              { lockedAt: { lt: staleThreshold } },
              { lockedAt: null },
            ],
          },
        }),
        db.jobSchedule.count({
          where: { isEnabled: true, nextRunAt: { lte: now } },
        }),
      ]);
      return {
        queued: queued ?? 0,
        running: running ?? 0,
        failed: failed ?? 0,
        deadLetter: deadLetter ?? 0,
        succeeded24h: 0,
        latestFailedJobType: null,
        staleRunning: staleRunning ?? 0,
        dueSchedules: dueSchedules ?? 0,
      };
    })(),
    (async () => {
      const [eventsToday, errorsToday, slowToday] = await Promise.all([
        db.opsEvent.count({ where: { createdAt: { gte: startToday } } }),
        db.opsEvent.count({ where: { createdAt: { gte: startToday }, level: "error" } }),
        db.opsEvent.count({ where: { createdAt: { gte: startToday }, durationMs: { gte: 2000 } } }),
      ]);
      return {
        eventsToday: eventsToday ?? 0,
        errorsToday: errorsToday ?? 0,
        slowEventsToday: slowToday ?? 0,
        lastErrorAt: null,
        topFailingAction: null,
      };
    })(),
    (async () => {
      const openReminders = await db.opsReminder.findMany({
        where: { status: { in: ["open", "snoozed"] } },
        select: { dueAt: true, snoozedUntil: true, status: true, priority: true },
      });
      const { classifyReminderBucket } = await import("@/lib/reminders/dates");
      let overdue = 0;
      let today = 0;
      let highPriority = 0;
      for (const r of openReminders) {
        const b = classifyReminderBucket(r.dueAt, r.snoozedUntil, r.status, now);
        if (b === "overdue") overdue++;
        if (b === "today") today++;
        if (r.priority === "high" || r.priority === "critical") highPriority++;
      }
      const suggestionsPending = await db.automationSuggestion.count({
        where: { status: "pending" },
      });
      return {
        remindersOverdue: overdue,
        remindersDueToday: today,
        remindersHighPriority: highPriority,
        suggestionsPending: suggestionsPending ?? 0,
      };
    })(),
  ]);

  const [overdue, today] = followupCounts;
  const [unscored, readyToPromote, promotedMissingNext, sentOverdue, wonMissingProof] = actionSummary;
  const [wonNoProof, readyPending, recordsMissing, promotedGaps] = proofGaps;
  const errorCount = integrations.filter((i) => i.status === "error").length;

  return {
    followupQueue: {
      followupsOverdue: overdue ?? 0,
      followupsDueToday: today ?? 0,
      followupsUpcoming: followupCounts[2] ?? 0,
    },
    intakeActions: {
      unscoredCount: unscored ?? 0,
      readyToPromoteCount: readyToPromote ?? 0,
      promotedMissingNextActionCount: promotedMissingNext ?? 0,
      sentFollowupOverdueCount: sentOverdue ?? 0,
      wonMissingProofCount: wonMissingProof ?? 0,
    },
    proofGaps: {
      wonLeadsWithoutProofCandidate: wonNoProof ?? 0,
      readyCandidatesPendingPromotion: readyPending ?? 0,
      proofRecordsMissingFields: recordsMissing ?? 0,
      promotedThisWeek: promotedGaps ?? 0,
    },
    jobsSummary,
    observability,
    remindersAutomation: remindersResult,
    integrationHealth: {
      errorCount,
      total: integrations.length,
    },
  };
}
