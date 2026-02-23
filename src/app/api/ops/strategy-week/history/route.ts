/**
 * GET /api/ops/strategy-week/history?weeks=8 — Recent weeks with summary + review checkmarks
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/strategyWeek";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/ops/strategy-week/history", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const weeksParam = searchParams.get("weeks");
    const weeks = Math.min(Math.max(parseInt(weeksParam ?? "8", 10) || 8, 1), 52);

    const currentWeekStart = getWeekStart();
    const startDate = new Date(currentWeekStart);
    startDate.setDate(startDate.getDate() - (weeks - 1) * 7);

    const records = await db.strategyWeek.findMany({
      where: { weekStart: { gte: startDate } },
      orderBy: { weekStart: "desc" },
      include: { review: true },
    });

    const items = records.map((r) => ({
      id: r.id,
      weekStart: r.weekStart.toISOString(),
      phase: r.phase,
      activeCampaignName: r.activeCampaignName,
      reviewChecks: r.review
        ? [
            r.review.campaignShipped,
            r.review.systemImproved,
            r.review.salesActionsDone,
            r.review.proofCaptured,
          ].filter(Boolean).length
        : 0,
      reviewTotal: 4,
      biggestBottleneck: r.review?.biggestBottleneck?.slice(0, 60) ?? null,
    }));

    return NextResponse.json({ items });
  });
}
