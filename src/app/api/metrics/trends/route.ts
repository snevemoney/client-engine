/**
 * GET /api/metrics/trends — Weekly trend points.
 * Query: weeks = 1..24 (default: 12), metricKey = won_value | delivered_value | accepted_count | intake_count (default: won_value)
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { buildWeekBuckets } from "@/lib/metrics/trends";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_WEEKS = 24;
const METRIC_KEYS = ["won_value", "delivered_value", "accepted_count", "intake_count", "proposals_sent", "delivery_completed", "proof_created", "handoffs_completed", "testimonials_received"] as const;

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/metrics/trends", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const weeksParam = parseInt(req.nextUrl.searchParams.get("weeks") ?? "12", 10);
    const weeks = Number.isFinite(weeksParam) ? Math.min(MAX_WEEKS, Math.max(1, weeksParam)) : 12;
    const metricKeyParam = req.nextUrl.searchParams.get("metricKey") ?? "won_value";
    const metricKey = METRIC_KEYS.includes(metricKeyParam as (typeof METRIC_KEYS)[number])
      ? (metricKeyParam as (typeof METRIC_KEYS)[number])
      : "won_value";

    try {
      const now = new Date();
      const buckets = buildWeekBuckets(now, weeks);

      const snapshots = await db.weeklyMetricSnapshot.findMany({
        where: {
          weekStart: { in: buckets },
          metricKey,
        },
        orderBy: { weekStart: "asc" },
      });

      const byWeek = new Map(snapshots.map((s) => [s.weekStart.toISOString().slice(0, 10), s]));

      const points = buckets.map((weekStart) => {
        const key = weekStart.toISOString().slice(0, 10);
        const snap = byWeek.get(key);
        const weekLabel = `W${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
        return {
          weekStart: key,
          weekLabel,
          value: snap?.metricValue ?? 0,
          count: snap?.metricCount ?? null,
        };
      });

      return NextResponse.json({
        metricKey,
        weeks,
        points,
      });
    } catch (err) {
      console.error("[metrics/trends]", err);
      return jsonError("Failed to load trends", 500);
    }
  });
}
