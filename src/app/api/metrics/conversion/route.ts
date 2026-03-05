/**
 * GET /api/metrics/conversion — Conversion metrics with range param.
 * Query: range = this_week | last_4_weeks | last_12_weeks | all (default: last_4_weeks)
 * Returns shape expected by /dashboard/conversion page.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { fetchConversionInput, fetchCycleTimeInput } from "@/lib/metrics/fetch-metrics";
import type { MetricsRange } from "@/lib/metrics/date-range";

export const dynamic = "force-dynamic";

const VALID_RANGES: MetricsRange[] = ["this_week", "last_4_weeks", "last_12_weeks", "all"];

function safeRate(num: number, denom: number): number {
  if (denom <= 0 || !Number.isFinite(denom)) return 0;
  const r = num / denom;
  return Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
}

function medianOfDeltas(deltas: number[]): number | null {
  const valid = deltas.filter((d) => Number.isFinite(d) && d >= 0);
  if (valid.length === 0) return null;
  valid.sort((a, b) => a - b);
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[mid]! : (valid[mid - 1]! + valid[mid]!) / 2;
}

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/metrics/conversion", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const rangeParam = req.nextUrl.searchParams.get("range") ?? "last_4_weeks";
    const range = VALID_RANGES.includes(rangeParam as MetricsRange) ? (rangeParam as MetricsRange) : "last_4_weeks";

    try {
      const [input, cycleInput] = await Promise.all([
        fetchConversionInput(range),
        fetchCycleTimeInput(range),
      ]);

      const total = input.intakeCount;
      const proposalSent = input.proposalSentCount;
      const approved = input.acceptedCount;
      const buildStarted = input.deliveryStartedCount;
      const buildCompleted = input.deliveryCompletedCount;
      const won = input.wonCount;
      const lost = input.lostCount;

      const counts = {
        total,
        proposalSent,
        approved,
        buildStarted,
        buildCompleted,
        won,
        lost,
      };

      const rates = {
        proposalSentRate: safeRate(proposalSent, total),
        approvedRate: safeRate(approved, proposalSent),
        buildStartRate: safeRate(buildStarted, approved),
        buildCompleteRate: safeRate(buildCompleted, buildStarted),
        winRate: safeRate(won, won + lost || approved),
      };

      const medianMsObj = {
        created_to_proposalSent: medianOfDeltas(
          cycleInput.proposalCreateToSent.map((p) =>
            p.createdAt && p.sentAt ? new Date(p.sentAt).getTime() - new Date(p.createdAt).getTime() : NaN,
          ),
        ),
        proposalSent_to_approved: medianOfDeltas(
          cycleInput.proposalSentToAccepted.map((p) =>
            p.sentAt && p.acceptedAt ? new Date(p.acceptedAt).getTime() - new Date(p.sentAt).getTime() : NaN,
          ),
        ),
        approved_to_buildStarted: medianOfDeltas(
          cycleInput.acceptedToDeliveryStart.map((p) =>
            p.acceptedAt && p.deliveryStartDate
              ? new Date(p.deliveryStartDate).getTime() - new Date(p.acceptedAt).getTime()
              : NaN,
          ),
        ),
        buildStarted_to_buildCompleted: medianOfDeltas(
          cycleInput.deliveryStartToComplete.map((p) =>
            p.startDate && p.completedAt
              ? new Date(p.completedAt).getTime() - new Date(p.startDate).getTime()
              : NaN,
          ),
        ),
      };

      return NextResponse.json({
        range,
        counts,
        rates,
        medianMs: medianMsObj,
      });
    } catch (err) {
      console.error("[metrics/conversion]", err);
      return jsonError("Failed to load conversion metrics", 500);
    }
  });
}
