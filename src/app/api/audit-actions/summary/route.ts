/**
 * GET /api/audit-actions/summary — Summary for dashboard
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getStartOfDay } from "@/lib/followup/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/audit-actions/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const todayStart = getStartOfDay(new Date());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() || 7) - 1));

    const [
      actionsToday,
      promotionsThisWeek,
      proposalsSentThisWeek,
      acceptsThisWeek,
      deliveriesCompletedThisWeek,
      proofsPromotedThisWeek,
      handoffsCompletedThisWeek,
      testimonialsReceivedThisWeek,
    ] = await Promise.all([
      db.auditAction.count({ where: { createdAt: { gte: todayStart } } }),
      db.auditAction.count({
        where: {
          createdAt: { gte: weekStart },
          actionKey: "intake.promote",
        },
      }),
      db.auditAction.count({
        where: {
          createdAt: { gte: weekStart },
          actionKey: "proposal.mark_sent",
        },
      }),
      db.auditAction.count({
        where: {
          createdAt: { gte: weekStart },
          actionKey: "proposal.accept",
        },
      }),
      db.auditAction.count({
        where: {
          createdAt: { gte: weekStart },
          actionKey: "delivery.complete",
        },
      }),
      db.auditAction.count({
        where: {
          createdAt: { gte: weekStart },
          actionKey: "proof.promote",
        },
      }),
      db.auditAction.count({
        where: {
          createdAt: { gte: weekStart },
          actionKey: "handoff.complete",
        },
      }),
      db.auditAction.count({
        where: {
          createdAt: { gte: weekStart },
          actionKey: "testimonial.receive",
        },
      }),
    ]);

    return NextResponse.json({
      actionsToday: actionsToday ?? 0,
      promotionsThisWeek: promotionsThisWeek ?? 0,
      proposalsSentThisWeek: proposalsSentThisWeek ?? 0,
      acceptsThisWeek: acceptsThisWeek ?? 0,
      deliveriesCompletedThisWeek: deliveriesCompletedThisWeek ?? 0,
      proofsPromotedThisWeek: proofsPromotedThisWeek ?? 0,
      handoffsCompletedThisWeek: handoffsCompletedThisWeek ?? 0,
      testimonialsReceivedThisWeek: testimonialsReceivedThisWeek ?? 0,
    });
  });
}
