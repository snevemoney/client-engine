import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";

/** GET /api/intake-leads/summary — counts for scoreboard card */
export async function GET() {
  return withRouteTiming("GET /api/intake-leads/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    return withSummaryCache("intake-leads/summary", async () => {
      const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const [
      newThisWeek,
      qualified,
      sent,
      won,
      sentThisWeek,
      wonThisWeek,
      proofCreatedThisWeek,
    ] = await Promise.all([
      db.intakeLead.count({
        where: {
          status: "new",
          createdAt: { gte: weekStart },
        },
      }),
      db.intakeLead.count({ where: { status: "qualified" } }),
      db.intakeLead.count({ where: { status: "sent" } }),
      db.intakeLead.count({ where: { status: "won" } }),
      db.intakeLead.count({
        where: {
          status: "sent",
          proposalSentAt: { gte: weekStart },
        },
      }),
      db.intakeLead.count({
        where: {
          status: "won",
          updatedAt: { gte: weekStart },
        },
      }),
      db.proofRecord.count({
        where: { createdAt: { gte: weekStart } },
      }),
    ]);

      return {
        newThisWeek,
        qualified,
        sent,
        won,
        sentThisWeek,
        wonThisWeek,
        proofCreatedThisWeek,
      };
    }, 15_000);
  });
}
