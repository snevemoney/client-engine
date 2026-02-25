/**
 * GET /api/metrics/summary — Combined metrics for Phase 2.3 Revenue Intelligence.
 * Returns: conversion, cycleTimes, revenue, bottlenecks, trendsPreview, weekStart.
 */
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { getWeekStart } from "@/lib/ops/weekStart";
import { computeConversionMetrics } from "@/lib/metrics/conversion";
import { computeCycleTimeMetrics } from "@/lib/metrics/cycle-times";
import { computeRevenueMetrics } from "@/lib/metrics/revenue";
import { buildWeekBuckets } from "@/lib/metrics/trends";
import { fetchConversionInput, fetchCycleTimeInput, fetchRevenueInput, fetchSourcePerformanceInput } from "@/lib/metrics/fetch-metrics";
import { fetchBottlenecks } from "@/lib/metrics/bottlenecks";
import { computeSourcePerformance } from "@/lib/metrics/source-performance";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/metrics/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("metrics/summary", async () => {
        const now = new Date();
        const weekStart = getWeekStart(now);
      const [convInput, cycleInput, revInput, sourceInput, bottlenecks, trendSnapshots] = await Promise.all([
        fetchConversionInput("this_week"),
        fetchCycleTimeInput("this_week"),
        fetchRevenueInput("this_week"),
        fetchSourcePerformanceInput("this_week"),
        fetchBottlenecks(),
        (async () => {
          const buckets = buildWeekBuckets(now, 4);
          const snapshots = await db.weeklyMetricSnapshot.findMany({
            where: {
              weekStart: { in: buckets },
              metricGroup: "revenue",
              metricKey: "won_value",
            },
            orderBy: { weekStart: "asc" },
          });
          return snapshots.map((s) => ({
            weekStart: s.weekStart.toISOString().slice(0, 10),
            value: s.metricValue ?? 0,
            count: s.metricCount ?? 0,
          }));
        })(),
      ]);

      const conversion = computeConversionMetrics({
        intakeCount: convInput.intakeCount,
        promotedCount: convInput.promotedCount,
        proposalCreatedCount: convInput.proposalCreatedCount,
        proposalSentCount: convInput.proposalSentCount,
        acceptedCount: convInput.acceptedCount,
        deliveryStartedCount: convInput.deliveryStartedCount,
        deliveryCompletedCount: convInput.deliveryCompletedCount,
        proofCreatedCount: convInput.proofCreatedCount,
      });

      const cycleTimes = computeCycleTimeMetrics(cycleInput);
      const revenue = computeRevenueMetrics(revInput);
      const sourcePerformance = computeSourcePerformance(sourceInput);

        return {
          conversion,
          cycleTimes,
          revenue,
          sourcePerformance,
          bottlenecks: bottlenecks ?? [],
          trendsPreview: trendSnapshots ?? [],
          weekStart: weekStart.toISOString().slice(0, 10),
        };
      }, 30_000);
    } catch (err) {
      console.error("[metrics/summary]", err);
      return jsonError("Failed to load metrics", 500);
    }
  });
}
