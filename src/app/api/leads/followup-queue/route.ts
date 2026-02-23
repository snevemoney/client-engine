/**
 * GET /api/leads/followup-queue — Leads sorted by overdue first, then qualification score, then nearest due date
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getQualificationTotal } from "@/lib/sales-driver/qualification";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/leads/followup-queue", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const leads = await db.lead.findMany({
      where: {
        status: { notIn: ["REJECTED", "SHIPPED"] },
        dealOutcome: { not: "won" },
      },
      orderBy: { nextActionDueAt: "asc" },
      take: 100,
      select: {
        id: true,
        title: true,
        driverType: true,
        nextAction: true,
        nextActionDueAt: true,
        scorePain: true,
        scoreUrgency: true,
        scoreBudget: true,
        scoreResponsiveness: true,
        scoreDecisionMaker: true,
        scoreFit: true,
        proposalSentAt: true,
      },
    });

    const withTotal = leads.map((l) => ({
      ...l,
      qualificationTotal: getQualificationTotal(l),
    }));

    // Sort: overdue first, then by score desc, then by due date asc
    withTotal.sort((a, b) => {
      const aOverdue = a.nextActionDueAt && a.nextActionDueAt < now;
      const bOverdue = b.nextActionDueAt && b.nextActionDueAt < now;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (a.qualificationTotal !== b.qualificationTotal) return b.qualificationTotal - a.qualificationTotal;
      if (!a.nextActionDueAt && !b.nextActionDueAt) return 0;
      if (!a.nextActionDueAt) return 1;
      if (!b.nextActionDueAt) return -1;
      return a.nextActionDueAt.getTime() - b.nextActionDueAt.getTime();
    });

    return NextResponse.json({
      items: withTotal.map((l) => ({
        id: l.id,
        title: l.title,
        driverType: l.driverType,
        qualificationTotal: l.qualificationTotal,
        nextAction: l.nextAction,
        nextActionDueAt: l.nextActionDueAt?.toISOString() ?? null,
        proposalSentAt: l.proposalSentAt?.toISOString() ?? null,
      })),
    });
  });
}
