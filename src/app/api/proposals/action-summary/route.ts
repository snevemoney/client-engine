/**
 * GET /api/proposals/action-summary — Proposal action counts for Command Center.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getStartOfDay } from "@/lib/followup/dates";

export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET() {
  return withRouteTiming("GET /api/proposals/action-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const startToday = getStartOfDay(now);
    const weekAgo = new Date(Date.now() - SEVEN_DAYS_MS);

    const [readyNotSent, sentProposals, sentNoResponseOver7d] = await Promise.all([
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
          responseStatus: true,
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
    ]);

    let sentNoFollowupDate = 0;
    let followupOverdue = 0;
    let stale = 0;
    let meetingBooked = 0;
    let negotiating = 0;

    for (const p of sentProposals) {
      if (!p.nextFollowUpAt) sentNoFollowupDate++;
      else if (p.nextFollowUpAt < startToday) followupOverdue++;

      const threshold = p.staleAfterDays ?? 7;
      if (p.sentAt && !p.respondedAt) {
        const daysSince = Math.floor((now.getTime() - p.sentAt.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSince >= threshold) stale++;
      }

      if (p.responseStatus === "meeting_booked") meetingBooked++;
      if (p.responseStatus === "negotiating") negotiating++;
    }

    return NextResponse.json({
      readyNotSent: readyNotSent ?? 0,
      sentNoFollowupDate: sentNoFollowupDate ?? 0,
      followupOverdue: followupOverdue ?? 0,
      stale: stale ?? 0,
      meetingBooked: meetingBooked ?? 0,
      negotiating: negotiating ?? 0,
      sentNoResponseOver7d: sentNoResponseOver7d ?? 0,
    });
  });
}
