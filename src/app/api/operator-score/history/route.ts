/**
 * GET /api/operator-score/history — Score history for trend display.
 * Query: periodType=weekly|monthly, limit (default 8, max 24)
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withRouteTiming("GET /api/operator-score/history", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(req.url);
      const periodType = (searchParams.get("periodType") ?? "weekly") as "weekly" | "monthly";
      const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "8", 10) || 8));

      const records = await db.operatorScoreSnapshot.findMany({
        where: { periodType },
        orderBy: { periodStart: "desc" },
        take: limit,
      });

      const items = records.map((r) => ({
        periodStart: r.periodStart.toISOString().slice(0, 10),
        score: r.score,
        grade: r.grade,
        summary: r.summary ?? null,
        breakdown: r.breakdownJson,
      }));

      return NextResponse.json({
        periodType,
        items: items.reverse(),
      });
    } catch (err) {
      console.error("[operator-score/history]", err);
      return jsonError("Failed to load history", 500);
    }
  });
}
