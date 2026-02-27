/**
 * GET /api/followups/summary — Metrics for scoreboard, reviews, and dashboard cards.
 * Includes driver-style warnings for FollowUpQueueCard (noNextAction, overdue3d, proposalsNoFollowUp).
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadActivityType, IntakeLeadStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { getStartOfDay, getEndOfDay, isValidDate } from "@/lib/followup/dates";
import { getWeekStart } from "@/lib/ops/weekStart";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/followups/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    return withSummaryCache("followups/summary", async () => {
      const now = new Date();
    const startToday = getStartOfDay(now);
    const endToday = getEndOfDay(now);
    const startOfWeek = getWeekStart(now);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const since7d = new Date(now);
    since7d.setDate(since7d.getDate() - 7);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const intakeWhere = { status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost] } };
    const pipelineWhere = {
      status: { notIn: ["REJECTED" as const, "SHIPPED" as const] },
      dealOutcome: { not: "won" as const },
    };

    const [
      intakeOverdue,
      pipelineOverdue,
      intakeToday,
      pipelineToday,
      completedThisWeek,
      callsThisWeek,
      emailsThisWeek,
      nextIntakeFollowUp,
      nextPipelineFollowUp,
      intakeNoNextAction,
      pipelineNoNextAction,
      intakeOverdue3d,
      pipelineOverdue3d,
      proposalsNoFollowUpIntake,
      proposalsNoFollowUpPipeline,
      lastTouch,
    ] = await Promise.all([
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
      db.intakeLead.count({
        where: {
          ...intakeWhere,
          followUpCompletedAt: { gte: startOfWeek, lte: endOfWeek },
        },
      }),
      db.leadActivity.count({
        where: {
          type: LeadActivityType.followup_call,
          createdAt: { gte: startOfWeek, lte: endOfWeek },
        },
      }),
      db.leadActivity.count({
        where: {
          type: LeadActivityType.followup_email,
          createdAt: { gte: startOfWeek, lte: endOfWeek },
        },
      }),
      db.intakeLead.findFirst({
        where: {
          ...intakeWhere,
          OR: [
            { nextActionDueAt: { not: null } },
            { followUpDueAt: { not: null } },
          ],
        },
        orderBy: [{ nextActionDueAt: "asc" }, { followUpDueAt: "asc" }],
        select: { nextActionDueAt: true, followUpDueAt: true },
      }),
      db.lead.findFirst({
        where: {
          nextActionDueAt: { not: null },
          status: { notIn: ["REJECTED", "SHIPPED"] },
          dealOutcome: { not: "won" },
        },
        orderBy: { nextActionDueAt: "asc" },
        select: { nextActionDueAt: true },
      }),
      db.intakeLead.count({
        where: {
          ...intakeWhere,
          nextAction: null,
          nextActionDueAt: null,
          followUpDueAt: null,
        },
      }),
      db.lead.count({
        where: { ...pipelineWhere, nextAction: null, nextActionDueAt: null },
      }),
      db.intakeLead.count({
        where: {
          ...intakeWhere,
          OR: [
            { nextActionDueAt: { lt: threeDaysAgo } },
            { followUpDueAt: { lt: threeDaysAgo } },
          ],
        },
      }),
      db.lead.count({
        where: { ...pipelineWhere, nextActionDueAt: { lt: threeDaysAgo } },
      }),
      db.proposal.count({
        where: {
          status: "sent",
          intakeLeadId: { not: null },
          intakeLead: {
            ...intakeWhere,
            nextActionDueAt: null,
            followUpDueAt: null,
          },
        },
      }),
      db.proposal.count({
        where: {
          status: "sent",
          pipelineLeadId: { not: null },
          pipelineLead: { ...pipelineWhere, nextActionDueAt: null },
        },
      }),
      db.leadTouch.findFirst({
        where: { lead: pipelineWhere },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const overdueCount = (intakeOverdue ?? 0) + (pipelineOverdue ?? 0);
    const todayCount = (intakeToday ?? 0) + (pipelineToday ?? 0);

    const intakeNext = nextIntakeFollowUp
      ? (nextIntakeFollowUp.nextActionDueAt && isValidDate(nextIntakeFollowUp.nextActionDueAt)
          ? nextIntakeFollowUp.nextActionDueAt
          : nextIntakeFollowUp.followUpDueAt)
      : null;
    const pipelineNext = nextPipelineFollowUp?.nextActionDueAt ?? null;
    const effectiveNext =
      intakeNext && pipelineNext
        ? (intakeNext < pipelineNext ? intakeNext : pipelineNext)
        : intakeNext ?? pipelineNext;

    const noNextAction = (intakeNoNextAction ?? 0) + (pipelineNoNextAction ?? 0);
    const overdue3d = (intakeOverdue3d ?? 0) + (pipelineOverdue3d ?? 0);
    const proposalsNoFollowUp = (proposalsNoFollowUpIntake ?? 0) + (proposalsNoFollowUpPipeline ?? 0);
    const lastTouchAt = lastTouch?.createdAt ?? null;
    const noSalesActions7d = lastTouchAt ? lastTouchAt < since7d : true;

    return {
      followupsDueToday: todayCount,
      followupsOverdue: overdueCount,
      followupsCompletedThisWeek: completedThisWeek ?? 0,
      callsLoggedThisWeek: callsThisWeek ?? 0,
      emailsLoggedThisWeek: emailsThisWeek ?? 0,
      nextFollowupDue: effectiveNext?.toISOString() ?? null,
      noNextAction,
      overdue3d,
      proposalsNoFollowUp,
      noSalesActions7d,
    };
    }, 15_000);
  });
}
