import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withRouteTiming } from "@/lib/api-utils";

/** GET /api/intake-leads/summary — counts for scoreboard card */
export async function GET() {
  return withRouteTiming("GET /api/intake-leads/summary", async () => {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    return NextResponse.json({
      newThisWeek,
      qualified,
      sent,
      won,
      sentThisWeek,
      wonThisWeek,
      proofCreatedThisWeek,
    });
  });
}
