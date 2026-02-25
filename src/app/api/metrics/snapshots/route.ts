/**
 * GET /api/metrics/snapshots — Historical snapshots by metricGroup, metricKey, weeks.
 * Query: metricGroup (required), metricKey (required), weeks = 1..52 (default: 12)
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { buildWeekBuckets } from "@/lib/metrics/trends";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_WEEKS = 52;

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/metrics/snapshots", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const metricGroup = req.nextUrl.searchParams.get("metricGroup")?.trim();
    const metricKey = req.nextUrl.searchParams.get("metricKey")?.trim();
    const weeksParam = parseInt(req.nextUrl.searchParams.get("weeks") ?? "12", 10);
    const weeks = Number.isFinite(weeksParam) ? Math.min(MAX_WEEKS, Math.max(1, weeksParam)) : 12;

    if (!metricGroup || !metricKey) {
      return jsonError("metricGroup and metricKey are required", 400);
    }

    try {
      const now = new Date();
      const buckets = buildWeekBuckets(now, weeks);

      const snapshots = await db.weeklyMetricSnapshot.findMany({
        where: {
          weekStart: { in: buckets },
          metricGroup,
          metricKey,
        },
        orderBy: { weekStart: "asc" },
      });

      return NextResponse.json({
        metricGroup,
        metricKey,
        weeks,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          weekStart: s.weekStart.toISOString().slice(0, 10),
          metricKey: s.metricKey,
          metricGroup: s.metricGroup,
          metricLabel: s.metricLabel,
          metricValue: s.metricValue,
          metricCount: s.metricCount,
          metaJson: s.metaJson,
        })),
      });
    } catch (err) {
      console.error("[metrics/snapshots]", err);
      return jsonError("Failed to load snapshots", 500);
    }
  });
}
