/**
 * GET /api/command-center — Aggregate data for operator daily view.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProofCandidateStatus, IntakeLeadStatus, Prisma } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getStartOfDay, getEndOfDay } from "@/lib/followup/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/command-center", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

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
        const [readyNotSent, sentNoResponse, acceptedNoProject, draftsIncomplete] = await Promise.all([
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
        ]);
        return { readyNotSent, sentNoResponseOver7d: sentNoResponse, acceptedNoProject, draftsIncomplete };
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

    return NextResponse.json({
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
      },
      deliveryOps: deliverySummary ?? {
        dueSoon: 0,
        overdue: 0,
        proofRequestedPending: 0,
        completedNoProofCandidate: 0,
      },
    });
  });
}
