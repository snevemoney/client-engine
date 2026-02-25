/**
 * GET /api/delivery-projects/handoff-summary — Handoff queue summary.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/delivery-projects/handoff-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const projects = await db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        id: true,
        status: true,
        completedAt: true,
        handoffStartedAt: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
      },
    });

    let completedNoHandoff = 0;
    let handoffInProgress = 0;
    let handoffCompleted = 0;
    let clientConfirmed = 0;
    let handoffMissingClientConfirm = 0;

    for (const p of projects) {
      const completed = p.status === "completed" || p.status === "archived";
      if (!completed) continue;

      const hasStarted = !!p.handoffStartedAt;
      const hasCompleted = !!p.handoffCompletedAt;
      const hasClientConfirm = !!p.clientConfirmedAt;

      if (!hasStarted && !hasCompleted) {
        completedNoHandoff++;
      } else if (hasStarted && !hasCompleted) {
        handoffInProgress++;
      } else if (hasCompleted) {
        handoffCompleted++;
        if (hasClientConfirm) {
          clientConfirmed++;
        } else {
          handoffMissingClientConfirm++;
        }
      }
    }

    return NextResponse.json({
      completedNoHandoff: completedNoHandoff ?? 0,
      handoffInProgress: handoffInProgress ?? 0,
      handoffCompleted: handoffCompleted ?? 0,
      clientConfirmed: clientConfirmed ?? 0,
      handoffMissingClientConfirm: handoffMissingClientConfirm ?? 0,
    });
  });
}
