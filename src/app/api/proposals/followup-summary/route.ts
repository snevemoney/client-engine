/**
 * GET /api/proposals/followup-summary — Proposal follow-up counts.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getStartOfDay, getEndOfDay } from "@/lib/followup/dates";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  return withRouteTiming("GET /api/proposals/followup-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const weekStart = getWeekStart(now);
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    const startToday = getStartOfDay(now);
    const endToday = getEndOfDay(now);
    const weekAgo = new Date(Date.now() - SEVEN_DAYS_MS);

    const proposals = await db.proposal.findMany({
      where: {
        status: { in: ["sent", "viewed"] },
        acceptedAt: null,
        rejectedAt: null,
      },
      select: {
        id: true,
        nextFollowUpAt: true,
        followUpCompletedAt: true,
        sentAt: true,
        respondedAt: true,
        meetingBookedAt: true,
        staleAfterDays: true,
      },
    });

    let dueToday = 0;
    let overdue = 0;
    let upcoming = 0;
    let stale = 0;
    let completedThisWeek = 0;
    let meetingBookedThisWeek = 0;

    for (const p of proposals) {
      const next = p.nextFollowUpAt;
      if (next) {
        if (next < startToday) overdue++;
        else if (next >= startToday && next <= endToday) dueToday++;
        else {
          const endUpcoming = new Date(now);
          endUpcoming.setDate(endUpcoming.getDate() + 7);
          endUpcoming.setHours(23, 59, 59, 999);
          if (next <= endUpcoming) upcoming++;
        }
      }

      const threshold = p.staleAfterDays ?? 7;
      const sent = p.sentAt;
      if (sent && !p.respondedAt) {
        const daysSince = Math.floor((now.getTime() - sent.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSince >= threshold) stale++;
      }

      if (p.followUpCompletedAt && p.followUpCompletedAt >= weekStart && p.followUpCompletedAt <= endOfWeek) {
        completedThisWeek++;
      }
      if (p.meetingBookedAt && p.meetingBookedAt >= weekStart && p.meetingBookedAt <= endOfWeek) {
        meetingBookedThisWeek++;
      }
    }

    const [emailsThisWeek, callsThisWeek, sentNoResponseOver7d] = await Promise.all([
      db.proposalActivity.count({
        where: {
          type: "followup_email",
          createdAt: { gte: weekStart, lte: endOfWeek },
        },
      }),
      db.proposalActivity.count({
        where: {
          type: "followup_call",
          createdAt: { gte: weekStart, lte: endOfWeek },
        },
      }),
      db.proposal.count({
        where: {
          status: "sent",
          sentAt: { lt: weekAgo },
          respondedAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      dueToday: dueToday ?? 0,
      overdue: overdue ?? 0,
      upcoming: upcoming ?? 0,
      stale: stale ?? 0,
      completedThisWeek: completedThisWeek ?? 0,
      emailsThisWeek: emailsThisWeek ?? 0,
      callsThisWeek: callsThisWeek ?? 0,
      meetingBookedThisWeek: meetingBookedThisWeek ?? 0,
      sentNoResponseOver7d: sentNoResponseOver7d ?? 0,
    });
  });
}
