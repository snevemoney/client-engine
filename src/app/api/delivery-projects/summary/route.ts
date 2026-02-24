/**
 * GET /api/delivery-projects/summary — This week metrics.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getWeekStart } from "@/lib/ops/weekStart";
import { computeProjectHealth } from "@/lib/delivery/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/delivery-projects/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const weekStart = getWeekStart(now);
    const endOfWeek = new Date(weekStart);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const projects = await db.deliveryProject.findMany({
      where: {
        status: { notIn: ["archived"] },
      },
      select: {
        id: true,
        status: true,
        dueDate: true,
        completedAt: true,
        proofRequestedAt: true,
        proofCandidateId: true,
      },
    });

    let inProgress = 0;
    let dueSoon = 0;
    let overdue = 0;
    let completedThisWeek = 0;
    let proofRequestedPending = 0;

    for (const p of projects) {
      const health = computeProjectHealth({ status: p.status, dueDate: p.dueDate });
      if (["kickoff", "in_progress", "qa"].includes(p.status)) inProgress++;
      if (health === "due_soon") dueSoon++;
      if (health === "overdue") overdue++;
      if (p.status === "completed" && p.completedAt && p.completedAt >= weekStart && p.completedAt <= endOfWeek) {
        completedThisWeek++;
      }
      if (p.proofRequestedAt && !p.proofCandidateId) proofRequestedPending++;
    }

    return NextResponse.json({
      inProgress,
      dueSoon,
      overdue,
      completedThisWeek,
      proofRequestedPending,
    });
  });
}
