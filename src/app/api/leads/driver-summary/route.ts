/**
 * GET /api/leads/driver-summary?range=7d|30d — Counts by driver type, no next action, overdue
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/leads/driver-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const range = url.searchParams.get("range") === "30d" ? 30 : 7;
    const since = new Date();
    since.setDate(since.getDate() - range);
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const [byDriver, noNextAction, overdue, overdue3d, proposalsNoFollowUp, lastTouch] = await Promise.all([
      db.lead.groupBy({
        by: ["driverType"],
        where: {
          status: { notIn: ["REJECTED", "SHIPPED"] },
          dealOutcome: { not: "won" },
          driverType: { not: null },
        },
        _count: true,
      }),
      db.lead.count({
        where: {
          status: { notIn: ["REJECTED", "SHIPPED"] },
          dealOutcome: { not: "won" },
          nextAction: null,
          nextActionDueAt: null,
        },
      }),
      db.lead.count({
        where: {
          status: { notIn: ["REJECTED", "SHIPPED"] },
          dealOutcome: { not: "won" },
          nextActionDueAt: { lt: now },
        },
      }),
      db.lead.count({
        where: {
          status: { notIn: ["REJECTED", "SHIPPED"] },
          dealOutcome: { not: "won" },
          nextActionDueAt: { lt: threeDaysAgo },
        },
      }),
      db.lead.count({
        where: {
          proposalSentAt: { not: null },
          dealOutcome: null,
          nextActionDueAt: null,
        },
      }),
      db.leadTouch.findFirst({
        where: { lead: { status: { notIn: ["REJECTED", "SHIPPED"] } } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const byDriverMap: Record<string, number> = {};
    for (const g of byDriver) {
      byDriverMap[g.driverType ?? "unknown"] = g._count;
    }

    const lastTouchAt = lastTouch?.createdAt ?? null;
    const noSalesActions7d = lastTouchAt ? lastTouchAt < since : true;

    return NextResponse.json({
      range: `${range}d`,
      byDriverType: byDriverMap,
      noNextAction,
      overdue,
      overdue3d,
      proposalsNoFollowUp,
      lastTouchAt: lastTouchAt?.toISOString() ?? null,
      noSalesActions7d,
    });
  });
}
