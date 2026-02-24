/**
 * GET /api/followups/summary — Metrics for scoreboard and reviews.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadStatus, LeadActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getStartOfDay, getEndOfDay, isValidDate } from "@/lib/followup/dates";
import { getWeekStart } from "@/lib/ops/weekStart";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/followups/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const startToday = getStartOfDay(now);
    const endToday = getEndOfDay(now);
    const startOfWeek = getWeekStart(now);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const intakeWhere = { status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost] } };

    const [overdueCount, todayCount, completedThisWeek, callsThisWeek, emailsThisWeek, nextFollowUp] =
      await Promise.all([
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
      ]);

    const effectiveNext = nextFollowUp
      ? (nextFollowUp.nextActionDueAt && isValidDate(nextFollowUp.nextActionDueAt)
          ? nextFollowUp.nextActionDueAt
          : nextFollowUp.followUpDueAt)
      : null;

    return NextResponse.json({
      followupsDueToday: todayCount ?? 0,
      followupsOverdue: overdueCount ?? 0,
      followupsCompletedThisWeek: completedThisWeek ?? 0,
      callsLoggedThisWeek: callsThisWeek ?? 0,
      emailsLoggedThisWeek: emailsThisWeek ?? 0,
      nextFollowupDue: effectiveNext?.toISOString() ?? null,
    });
  });
}
