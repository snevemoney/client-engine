/**
 * GET /api/metrics/revenue — Revenue metrics with range param.
 * Query: range = this_week | last_4_weeks | last_12_weeks | all (default: last_4_weeks)
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { computeRevenueMetrics } from "@/lib/metrics/revenue";
import { fetchRevenueInput } from "@/lib/metrics/fetch-metrics";
import type { MetricsRange } from "@/lib/metrics/date-range";

export const dynamic = "force-dynamic";

const VALID_RANGES: MetricsRange[] = ["this_week", "last_4_weeks", "last_12_weeks", "all"];

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/metrics/revenue", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const rangeParam = req.nextUrl.searchParams.get("range") ?? "last_4_weeks";
    const range = VALID_RANGES.includes(rangeParam as MetricsRange) ? (rangeParam as MetricsRange) : "last_4_weeks";

    try {
      const input = await fetchRevenueInput(range);
      const metrics = computeRevenueMetrics({
        weekStart: input.weekStart,
        weekEnd: input.weekEnd,
        proposals: input.proposals,
        deliveryProjects: input.deliveryProjects,
        upsellOpenValue: input.upsellOpenValue,
        retainerOpenCount: input.retainerOpenCount,
      });

      return NextResponse.json({
        range,
        ...metrics,
      });
    } catch (err) {
      console.error("[metrics/revenue]", err);
      return jsonError("Failed to load revenue metrics", 500);
    }
  });
}
