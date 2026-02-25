/**
 * GET /api/delivery-projects/handoff-weekly — Handoff weekly stats.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getWeekStart } from "@/lib/ops/weekStart";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/delivery-projects/handoff-weekly", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const weekStart = getWeekStart(now);
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const projects = await db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        handoffStartedAt: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
      },
    });

    let handoffsCompletedThisWeek = 0;
    let clientConfirmedThisWeek = 0;
    let handoffInProgress = 0;
    let handoffMissingClientConfirm = 0;

    for (const p of projects) {
      const hasStarted = !!p.handoffStartedAt;
      const hasCompleted = !!p.handoffCompletedAt;
      const hasClientConfirm = !!p.clientConfirmedAt;

      if (hasCompleted && p.handoffCompletedAt && p.handoffCompletedAt >= weekStart && p.handoffCompletedAt <= endOfWeek) {
        handoffsCompletedThisWeek++;
      }
      if (hasClientConfirm && p.clientConfirmedAt && p.clientConfirmedAt >= weekStart && p.clientConfirmedAt <= endOfWeek) {
        clientConfirmedThisWeek++;
      }
      if (hasStarted && !hasCompleted) handoffInProgress++;
      if (hasCompleted && !hasClientConfirm) handoffMissingClientConfirm++;
    }

    return NextResponse.json({
      handoffsCompletedThisWeek: handoffsCompletedThisWeek ?? 0,
      clientConfirmedThisWeek: clientConfirmedThisWeek ?? 0,
      handoffInProgress: handoffInProgress ?? 0,
      handoffMissingClientConfirm: handoffMissingClientConfirm ?? 0,
    });
  });
}
