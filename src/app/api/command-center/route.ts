/**
 * GET /api/command-center — Aggregate data for operator daily view.
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProofCandidateStatus, IntakeLeadStatus, Prisma } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getStartOfDay, getEndOfDay } from "@/lib/followup/dates";
import { fetchConversionInput, fetchRevenueInput } from "@/lib/metrics/fetch-metrics";
import { computeConversionMetrics } from "@/lib/metrics/conversion";
import { computeRevenueMetrics } from "@/lib/metrics/revenue";
import { fetchBottlenecks } from "@/lib/metrics/bottlenecks";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/command-center", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    return withSummaryCache("command-center", async () => {
      const now = new Date();
    const startToday = getStartOfDay(now);
    const endToday = getEndOfDay(now);
    const weekStart = getWeekStart(now);
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const intakeWhere = { status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost] } };

    const [
      strategyWeek,
      prioritiesResult,
      followupCounts,
      actionSummary,
      proofGaps,
      proofCandidateSummary,
      integrations,
      proposalGaps,
      deliverySummary,
      handoffOps,
      retentionOps,
    ] = await Promise.all([
      db.strategyWeek.findUnique({
        where: { weekStart },
        include: { review: true, priorities: true },
      }),
      db.strategyWeek.findUnique({
        where: { weekStart },
        include: { priorities: { orderBy: { priorityOrder: "asc" }, take: 5 } },
      }),
      Promise.all([
        (async () => {
          const [intakeOverdue, pipelineOverdue] = await Promise.all([
            db.intakeLead.count({
              where: {
                ...intakeWhere,
                OR: [
                  { nextActionDueAt: { lt: startToday } },
                  { followUpDueAt: { lt: startToday } },
                ],
              },
            }),
            db.lead.count({
              where: {
                nextActionDueAt: { lt: startToday },
                status: { notIn: ["REJECTED", "SHIPPED"] },
                dealOutcome: { not: "won" },
              },
            }),
          ]);
          return (intakeOverdue ?? 0) + (pipelineOverdue ?? 0);
        })(),
        (async () => {
          const [intakeToday, pipelineToday] = await Promise.all([
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
            db.lead.count({
              where: {
                nextActionDueAt: { gte: startToday, lte: endToday },
                status: { notIn: ["REJECTED", "SHIPPED"] },
                dealOutcome: { not: "won" },
              },
            }),
          ]);
          return (intakeToday ?? 0) + (pipelineToday ?? 0);
        })(),
        (async () => {
          const [intakeUpcoming, pipelineUpcoming] = await Promise.all([
            db.intakeLead.count({
              where: {
                ...intakeWhere,
                OR: [
                  { nextActionDueAt: { gt: endToday } },
                  { followUpDueAt: { gt: endToday } },
                ],
              },
            }),
            db.lead.count({
              where: {
                nextActionDueAt: { gt: endToday },
                status: { notIn: ["REJECTED", "SHIPPED"] },
                dealOutcome: { not: "won" },
              },
            }),
          ]);
          return (intakeUpcoming ?? 0) + (pipelineUpcoming ?? 0);
        })(),
      ]),
      (async () => {
        const [intakeUnscored, pipelineUnscored] = await Promise.all([
          db.intakeLead.count({
            where: {
              status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost, IntakeLeadStatus.archived] },
              score: null,
            },
          }),
          db.lead.count({
            where: {
              status: { notIn: ["REJECTED", "SHIPPED"] },
              dealOutcome: { not: "won" },
              score: null,
            },
          }),
        ]);
        const unscored = (intakeUnscored ?? 0) + (pipelineUnscored ?? 0);

        const readyToPromote = await db.intakeLead.count({
          where: {
            status: { in: ["qualified", "proposal_drafted"] },
            promotedLeadId: null,
            title: { not: "" },
            summary: { not: "" },
          },
        });

        const promotedMissingNext = await db.intakeLead.count({
          where: {
            promotedLeadId: { not: null },
            nextActionDueAt: null,
            followUpDueAt: null,
            status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost] },
          },
        });

        const sentOverdue = await db.intakeLead.count({
          where: {
            status: "sent",
            OR: [
              { followUpDueAt: { lt: startToday } },
              { nextActionDueAt: { lt: startToday } },
            ],
          },
        });

        const [intakeWonMissing, pipelineWonMissing] = await Promise.all([
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
        const wonMissingProof = (intakeWonMissing ?? 0) + (pipelineWonMissing ?? 0);

        return [unscored, readyToPromote ?? 0, promotedMissingNext ?? 0, sentOverdue ?? 0, wonMissingProof];
      })(),
      (async () => {
        const [intakeWonNoProof, pipelineWonNoProof] = await Promise.all([
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
        const wonNoProof = (intakeWonNoProof ?? 0) + (pipelineWonNoProof ?? 0);

        const [readyPending, recordsMissing, promotedGaps] = await Promise.all([
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
        ]);
        return [wonNoProof, readyPending ?? 0, recordsMissing ?? 0, promotedGaps ?? 0];
      })(),
      (async () => {
        const [created, ready, promoted, pendingDrafts, pendingReady] = await Promise.all([
          db.proofCandidate.count({
            where: { createdAt: { gte: weekStart, lte: endOfWeek } },
          }),
          db.proofCandidate.count({
            where: {
              status: ProofCandidateStatus.ready,
              readyAt: { gte: weekStart, lte: endOfWeek },
            },
          }),
          db.proofCandidate.count({
            where: {
              status: ProofCandidateStatus.promoted,
              promotedAt: { gte: weekStart, lte: endOfWeek },
            },
          }),
          db.proofCandidate.count({ where: { status: "draft" } }),
          db.proofCandidate.count({ where: { status: ProofCandidateStatus.ready } }),
        ]);
        return {
          createdThisWeek: created ?? 0,
          readyThisWeek: ready ?? 0,
          promotedThisWeek: promoted ?? 0,
          pendingDrafts: pendingDrafts ?? 0,
          pendingReady: pendingReady ?? 0,
        };
      })(),
      db.integrationConnection.findMany({
        where: { isEnabled: true },
        select: { provider: true, mode: true, status: true },
      }),
      (async () => {
        const [readyNotSent, sentNoResponse, acceptedNoProject, draftsIncomplete, sentProposals] = await Promise.all([
          db.proposal.count({ where: { status: "ready" } }),
          db.proposal.count({
            where: { status: "sent", sentAt: { lt: new Date(Date.now() - 7 * 86400000) }, respondedAt: null },
          }),
          db.proposal.count({
            where: { status: "accepted", deliveryProjects: { none: {} } },
          }),
          db.proposal.count({
            where: {
              status: "draft",
              OR: [
                { summary: null },
                { scopeOfWork: null },
                { cta: null },
                { deliverables: { equals: Prisma.JsonNull } },
              ],
            },
          }),
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
              responseStatus: true,
              staleAfterDays: true,
            },
          }),
        ]);
        let sentNoFollowupDate = 0;
        let followupOverdue = 0;
        let stale = 0;
        let meetingBooked = 0;
        let negotiating = 0;
        for (const p of sentProposals ?? []) {
          if (!p.nextFollowUpAt) sentNoFollowupDate++;
          else if (p.nextFollowUpAt < startToday) followupOverdue++;
          const threshold = p.staleAfterDays ?? 7;
          if (p.sentAt && !p.respondedAt) {
            const daysSince = Math.floor((now.getTime() - p.sentAt.getTime()) / 86400000);
            if (daysSince >= threshold) stale++;
          }
          if (p.responseStatus === "meeting_booked") meetingBooked++;
          if (p.responseStatus === "negotiating") negotiating++;
        }
        return {
          readyNotSent,
          sentNoResponseOver7d: sentNoResponse,
          acceptedNoProject,
          draftsIncomplete,
          sentNoFollowupDate,
          followupOverdue,
          stale,
          meetingBooked,
          negotiating,
        };
      })(),
      (async () => {
        const projects = await db.deliveryProject.findMany({
          where: { status: { notIn: ["archived"] } },
          select: { status: true, dueDate: true, proofRequestedAt: true, proofCandidateId: true },
        });
        const now = new Date();
        const msPerDay = 86400000;
        let dueSoon = 0;
        let overdue = 0;
        let proofRequestedPending = 0;
        let completedNoProof = 0;
        for (const p of projects) {
          if (p.dueDate) {
            const days = (new Date(p.dueDate).getTime() - now.getTime()) / msPerDay;
            if (days < 0) overdue++;
            else if (days <= 3) dueSoon++;
          }
          if (p.proofRequestedAt && !p.proofCandidateId) proofRequestedPending++;
          if (p.status === "completed" && !p.proofCandidateId) completedNoProof++;
        }
        return { dueSoon, overdue, proofRequestedPending, completedNoProofCandidate: completedNoProof };
      })(),
      (async () => {
        const projects = await db.deliveryProject.findMany({
          where: { status: { in: ["completed", "archived"] } },
          select: {
            handoffStartedAt: true,
            handoffCompletedAt: true,
            clientConfirmedAt: true,
          },
        });
        let completedNoHandoff = 0;
        let handoffInProgress = 0;
        let handoffDoneNoClientConfirm = 0;
        for (const p of projects) {
          const hasStarted = !!p.handoffStartedAt;
          const hasCompleted = !!p.handoffCompletedAt;
          const hasClientConfirm = !!p.clientConfirmedAt;
          if (!hasStarted && !hasCompleted) completedNoHandoff++;
          else if (hasStarted && !hasCompleted) handoffInProgress++;
          else if (hasCompleted && !hasClientConfirm) handoffDoneNoClientConfirm++;
        }
        return { completedNoHandoff, handoffInProgress, handoffDoneNoClientConfirm };
      })(),
      (async () => {
        const projects = await db.deliveryProject.findMany({
          where: { status: { in: ["completed", "archived"] } },
          select: {
            retentionNextFollowUpAt: true,
            retentionStatus: true,
            testimonialRequestedAt: true,
            testimonialReceivedAt: true,
            reviewRequestedAt: true,
            reviewReceivedAt: true,
            referralRequestedAt: true,
            referralReceivedAt: true,
            handoffCompletedAt: true,
            retentionLastContactedAt: true,
          },
        });
        const { classifyRetentionBucket, computeRetentionStale } = await import("@/lib/delivery/retention");
        let retentionOverdue = 0;
        let completedNoTestimonialRequest = 0;
        let completedNoReviewRequest = 0;
        let completedNoReferralRequest = 0;
        let completedNoRetentionFollowup = 0;
        let upsellOpen = 0;
        let retainerOpen = 0;
        let stalePostDelivery = 0;
        for (const p of projects) {
          const bucket = classifyRetentionBucket(p.retentionNextFollowUpAt, now);
          if (bucket === "overdue") retentionOverdue++;
          if (!p.testimonialRequestedAt) completedNoTestimonialRequest++;
          if (!p.reviewRequestedAt) completedNoReviewRequest++;
          if (!p.referralRequestedAt) completedNoReferralRequest++;
          const hasRetention = p.retentionNextFollowUpAt || p.retentionLastContactedAt;
          if (!hasRetention) completedNoRetentionFollowup++;
          const status = (p.retentionStatus ?? "none").toString();
          if (status === "upsell_open") upsellOpen++;
          if (status === "retainer_open") retainerOpen++;
          const { isStale } = computeRetentionStale(p);
          if (isStale) stalePostDelivery++;
        }
        return {
          retentionOverdue,
          completedNoTestimonialRequest,
          completedNoReviewRequest,
          completedNoReferralRequest,
          completedNoRetentionFollowup,
          upsellOpen,
          retainerOpen,
          stalePostDelivery,
        };
      })(),
    ]);

    const priorities = prioritiesResult?.priorities ?? [];
    const [overdue, today, upcoming] = followupCounts;
    const [unscored, readyToPromote, promotedMissingNext, sentOverdue, wonMissingProof] = actionSummary;
    const [wonNoProof, readyPending, recordsMissing, promotedGaps] = proofGaps;
    const pc = proofCandidateSummary ?? {};

    const byMode = { off: 0, mock: 0, manual: 0, live: 0 };
    const errorCount = integrations.filter((i) => i.status === "error").length;
    for (const i of integrations) {
      const mode = ["off", "mock", "manual", "live"].includes(i.mode) ? i.mode : "off";
      byMode[mode] += 1;
    }

    const todayPriorities = priorities
      .filter((p) => p.status === "todo" || p.status === "in_progress")
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.title ?? "",
        status: p.status ?? "todo",
        dueDate: p.dueDate?.toISOString() ?? null,
      }));

      return {
      todaysPriorities: todayPriorities,
      followupQueue: {
        followupsOverdue: overdue ?? 0,
        followupsDueToday: today ?? 0,
        followupsUpcoming: upcoming ?? 0,
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
      proofCandidates: {
        createdThisWeek: pc.createdThisWeek ?? 0,
        readyThisWeek: pc.readyThisWeek ?? 0,
        promotedThisWeek: pc.promotedThisWeek ?? 0,
        pendingDrafts: pc.pendingDrafts ?? 0,
        pendingReady: pc.pendingReady ?? 0,
      },
      weeklyCommitments: strategyWeek
        ? {
            declaredCommitment: strategyWeek.declaredCommitment ?? null,
            reviewCompleted: !!strategyWeek.review?.completedAt,
            reviewCompletedAt: strategyWeek.review?.completedAt?.toISOString() ?? null,
          }
        : null,
      integrationHealth: {
        byMode,
        errorCount: errorCount ?? 0,
        total: integrations.length,
      },
      proposalActions: proposalGaps ?? {
        readyNotSent: 0,
        sentNoResponseOver7d: 0,
        acceptedNoProject: 0,
        draftsIncomplete: 0,
        sentNoFollowupDate: 0,
        followupOverdue: 0,
        stale: 0,
        meetingBooked: 0,
        negotiating: 0,
      },
      deliveryOps: deliverySummary ?? {
        dueSoon: 0,
        overdue: 0,
        proofRequestedPending: 0,
        completedNoProofCandidate: 0,
      },
      handoffOps: handoffOps ?? {
        completedNoHandoff: 0,
        handoffInProgress: 0,
        handoffDoneNoClientConfirm: 0,
      },
      retentionOps: retentionOps ?? {
        retentionOverdue: 0,
        completedNoTestimonialRequest: 0,
        completedNoReviewRequest: 0,
        completedNoReferralRequest: 0,
        completedNoRetentionFollowup: 0,
        upsellOpen: 0,
        retainerOpen: 0,
        stalePostDelivery: 0,
      },
      revenueIntelligence: await (async () => {
        try {
          const [convInput, revInput, bottlenecks] = await Promise.all([
            fetchConversionInput("this_week"),
            fetchRevenueInput("this_week"),
            fetchBottlenecks(),
          ]);
          const conversion = computeConversionMetrics(convInput);
          const revenue = computeRevenueMetrics(revInput);
          const topBottleneck = (bottlenecks ?? [])[0];
          return {
            proposalSentToAcceptedRate: conversion.proposalSentToAcceptedRate,
            acceptedToDeliveryStartedRate: conversion.acceptedToDeliveryStartedRate,
            deliveryCompletedToProofRate: conversion.deliveryCompletedToProofRate,
            deliveredValueThisWeek: revenue.deliveredValueThisWeek,
            topBottleneck: topBottleneck
              ? { label: topBottleneck.label, count: topBottleneck.count }
              : null,
          };
        } catch {
          return {
            proposalSentToAcceptedRate: 0,
            acceptedToDeliveryStartedRate: 0,
            deliveryCompletedToProofRate: 0,
            deliveredValueThisWeek: 0,
            topBottleneck: null,
          };
        }
      })(),
      operatorForecast: await (async () => {
        try {
          const [
            { fetchOperatorScoreInput },
            { computeOperatorScore },
            { fetchWeeklyForecastInput, fetchMonthlyForecastInput },
            { computeWeeklyForecast, computeMonthlyForecast },
          ] = await Promise.all([
            import("@/lib/operator-score/fetch-input"),
            import("@/lib/operator-score/score"),
            import("@/lib/forecasting/fetch-input"),
            import("@/lib/forecasting/forecast"),
          ]);
          const now = new Date();
          const [weeklyScoreInput, monthlyScoreInput, weeklyForecastInput, monthlyForecastInput] = await Promise.all([
            fetchOperatorScoreInput("weekly"),
            fetchOperatorScoreInput("monthly"),
            fetchWeeklyForecastInput(now),
            fetchMonthlyForecastInput(now),
          ]);
          const weeklyScore = computeOperatorScore(weeklyScoreInput);
          const monthlyScore = computeOperatorScore(monthlyScoreInput);
          const weeklyForecast = computeWeeklyForecast(weeklyForecastInput);
          const monthlyForecast = computeMonthlyForecast(monthlyForecastInput);
          const deliveredMetric = monthlyForecast.metrics.find((m) => m.key === "delivered_value");
          const behindWarnings = weeklyForecast.warnings.concat(monthlyForecast.warnings).filter((w) => w.includes("Behind pace"));
          return {
            weeklyScore: weeklyScore.score,
            weeklyGrade: weeklyScore.grade,
            monthlyScore: monthlyScore.score,
            monthlyGrade: monthlyScore.grade,
            behindPaceWarning: behindWarnings[0] ?? null,
            deliveredValueProjectedMonth: deliveredMetric?.projected ?? null,
          };
        } catch {
          return {
            weeklyScore: null,
            weeklyGrade: null,
            monthlyScore: null,
            monthlyGrade: null,
            behindPaceWarning: null,
            deliveredValueProjectedMonth: null,
          };
        }
      })(),
      observability: await (async () => {
        try {
          const todayStart = getStartOfDay(now);
          const [eventsToday, errorsToday, slowToday, lastError, topError] = await Promise.all([
            db.opsEvent.count({ where: { createdAt: { gte: todayStart } } }),
            db.opsEvent.count({ where: { createdAt: { gte: todayStart }, level: "error" } }),
            db.opsEvent.count({ where: { createdAt: { gte: todayStart }, durationMs: { gte: 2000 } } }),
            db.opsEvent.findFirst({
              where: { level: "error" },
              orderBy: { createdAt: "desc" },
              select: { createdAt: true, eventKey: true },
            }),
            db.opsEvent.groupBy({
              by: ["eventKey"],
              where: { createdAt: { gte: todayStart }, level: "error" },
              _count: { id: true },
              orderBy: { _count: { eventKey: "desc" } },
              take: 1,
            }),
          ]);
          return {
            eventsToday: eventsToday ?? 0,
            errorsToday: errorsToday ?? 0,
            slowEventsToday: slowToday ?? 0,
            lastErrorAt: lastError?.createdAt?.toISOString() ?? null,
            topFailingAction: topError[0]?.eventKey ?? null,
          };
        } catch {
          return {
            eventsToday: 0,
            errorsToday: 0,
            slowEventsToday: 0,
            lastErrorAt: null,
            topFailingAction: null,
          };
        }
      })(),
      auditSummary: await (async () => {
        try {
          const todayStart = getStartOfDay(now);
          const weekStart = getWeekStart(now);
          const [actionsToday, proposalsSent, deliveriesCompleted, proofsPromoted] = await Promise.all([
            db.auditAction.count({ where: { createdAt: { gte: todayStart } } }),
            db.auditAction.count({ where: { createdAt: { gte: weekStart }, actionKey: "proposal.mark_sent" } }),
            db.auditAction.count({ where: { createdAt: { gte: weekStart }, actionKey: "delivery.complete" } }),
            db.auditAction.count({ where: { createdAt: { gte: weekStart }, actionKey: "proof.promote" } }),
          ]);
          return {
            actionsToday: actionsToday ?? 0,
            proposalsSentThisWeek: proposalsSent ?? 0,
            deliveriesCompletedThisWeek: deliveriesCompleted ?? 0,
            proofsPromotedThisWeek: proofsPromoted ?? 0,
          };
        } catch {
          return {
            actionsToday: 0,
            proposalsSentThisWeek: 0,
            deliveriesCompletedThisWeek: 0,
            proofsPromotedThisWeek: 0,
          };
        }
      })(),
      jobsSummary: await (async () => {
        try {
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
          const [queued, running, failed, deadLetter, succeeded24h, latestFailed, staleRunning, dueSchedules] = await Promise.all([
            db.jobRun.count({ where: { status: "queued" } }),
            db.jobRun.count({ where: { status: "running" } }),
            db.jobRun.count({ where: { status: "failed" } }),
            db.jobRun.count({ where: { status: "dead_letter" } }),
            db.jobRun.count({ where: { status: "succeeded", finishedAt: { gte: dayAgo } } }),
            db.jobRun.findFirst({
              where: { status: { in: ["failed", "dead_letter"] } },
              orderBy: { finishedAt: "desc" },
              select: { jobType: true },
            }),
            db.jobRun.count({
              where: {
                status: "running",
                OR: [
                  { lockedAt: { lt: staleThreshold } },
                  { lockedAt: null, startedAt: { lt: staleThreshold } },
                ],
              },
            }),
            db.jobSchedule.count({
              where: { isEnabled: true, nextRunAt: { lte: new Date() } },
            }),
          ]);
          return {
            queued: queued ?? 0,
            running: running ?? 0,
            failed: failed ?? 0,
            deadLetter: deadLetter ?? 0,
            succeeded24h: succeeded24h ?? 0,
            latestFailedJobType: latestFailed?.jobType ?? null,
            staleRunning: staleRunning ?? 0,
            dueSchedules: dueSchedules ?? 0,
          };
        } catch {
          return {
            queued: 0,
            running: 0,
            failed: 0,
            deadLetter: 0,
            succeeded24h: 0,
            latestFailedJobType: null,
            staleRunning: 0,
            dueSchedules: 0,
          };
        }
      })(),
      remindersAutomation: await (async () => {
        try {
          const { classifyReminderBucket } = await import("@/lib/reminders/dates");
          const now = new Date();
          const startToday = getStartOfDay(now);
          const [openReminders, pendingSuggestions] = await Promise.all([
            db.opsReminder.findMany({
              where: { status: { in: ["open", "snoozed"] } },
              select: { id: true, title: true, dueAt: true, snoozedUntil: true, status: true, priority: true, actionUrl: true },
              orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
              take: 10,
            }),
            db.automationSuggestion.findMany({
              where: { status: "pending" },
              select: { id: true, title: true, actionUrl: true },
              take: 5,
            }),
          ]);
          let overdue = 0;
          let today = 0;
          let highPriority = 0;
          for (const r of openReminders) {
            const b = classifyReminderBucket(r.dueAt, r.snoozedUntil, r.status, now);
            if (b === "overdue") overdue++;
            if (b === "today") today++;
            if (r.priority === "high" || r.priority === "critical") highPriority++;
          }
          const bestReminder = openReminders[0];
          const bestSuggestion = pendingSuggestions[0];
          return {
            remindersOverdue: overdue,
            remindersDueToday: today,
            remindersHighPriority: highPriority,
            suggestionsPending: pendingSuggestions.length,
            bestNextAction: bestReminder
              ? { type: "reminder", title: bestReminder.title, url: bestReminder.actionUrl ?? "/dashboard/reminders" }
              : bestSuggestion
                ? { type: "suggestion", title: bestSuggestion.title, url: bestSuggestion.actionUrl ?? "/dashboard/automation" }
                : null,
          };
        } catch {
          return {
            remindersOverdue: 0,
            remindersDueToday: 0,
            remindersHighPriority: 0,
            suggestionsPending: 0,
            bestNextAction: null,
          };
        }
      })(),
      };
    }, 15_000);
  });
}
