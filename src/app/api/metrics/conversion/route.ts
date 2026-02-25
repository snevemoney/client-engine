/**
 * GET /api/metrics/conversion — Conversion metrics with range param.
 * Query: range = this_week | last_4_weeks | last_12_weeks | all (default: last_4_weeks)
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { computeConversionMetrics } from "@/lib/metrics/conversion";
import { fetchConversionInput } from "@/lib/metrics/fetch-metrics";
import type { MetricsRange } from "@/lib/metrics/date-range";

export const dynamic = "force-dynamic";

const VALID_RANGES: MetricsRange[] = ["this_week", "last_4_weeks", "last_12_weeks", "all"];

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/metrics/conversion", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const rangeParam = req.nextUrl.searchParams.get("range") ?? "last_4_weeks";
    const range = VALID_RANGES.includes(rangeParam as MetricsRange) ? (rangeParam as MetricsRange) : "last_4_weeks";

    try {
      const input = await fetchConversionInput(range);
      const metrics = computeConversionMetrics({
        intakeCount: input.intakeCount,
        promotedCount: input.promotedCount,
        proposalCreatedCount: input.proposalCreatedCount,
        proposalSentCount: input.proposalSentCount,
        acceptedCount: input.acceptedCount,
        deliveryStartedCount: input.deliveryStartedCount,
        deliveryCompletedCount: input.deliveryCompletedCount,
        proofCreatedCount: input.proofCreatedCount,
      });

      return NextResponse.json({
        range,
        ...metrics,
      });
    } catch (err) {
      console.error("[metrics/conversion]", err);
      return jsonError("Failed to load conversion metrics", 500);
    }
  });
}
