/**
 * Phase 2.8.4: Metrics snapshot service — shared by route and job handler.
 */

import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { fetchConversionInput, fetchCycleTimeInput, fetchRevenueInput, fetchSourcePerformanceInput } from "@/lib/metrics/fetch-metrics";
import { computeConversionMetrics } from "@/lib/metrics/conversion";
import { computeCycleTimeMetrics } from "@/lib/metrics/cycle-times";
import { computeRevenueMetrics } from "@/lib/metrics/revenue";
import { computeSourcePerformance } from "@/lib/metrics/source-performance";

const METRICS_TO_SNAPSHOT: Array<{
  key: string;
  group: string;
  label: string;
  getValue: (data: {
    conversion: ReturnType<typeof computeConversionMetrics>;
    cycleTimes: ReturnType<typeof computeCycleTimeMetrics>;
    revenue: ReturnType<typeof computeRevenueMetrics>;
    source: ReturnType<typeof computeSourcePerformance>;
    handoffsCompleted?: number;
    testimonialsReceived?: number;
  }) => { value: number; count?: number };
}> = [
  { key: "proposal_sent_to_accepted_rate", group: "conversion", label: "Proposal sent → accepted %", getValue: (d) => ({ value: d.conversion.proposalSentToAcceptedRate * 100, count: d.conversion.counts.proposalSent }) },
  { key: "accepted_to_delivery_rate", group: "conversion", label: "Accepted → delivery started %", getValue: (d) => ({ value: d.conversion.acceptedToDeliveryStartedRate * 100, count: d.conversion.counts.accepted }) },
  { key: "delivery_to_proof_rate", group: "conversion", label: "Delivery completed → proof %", getValue: (d) => ({ value: d.conversion.deliveryCompletedToProofRate * 100, count: d.conversion.counts.deliveryCompleted }) },
  { key: "sent_to_accepted_avg_days", group: "cycle_time", label: "Sent → accepted avg days", getValue: (d) => ({ value: d.cycleTimes.proposalSentToAcceptedAvgDays, count: d.cycleTimes.counts.proposalSentToAccepted }) },
  { key: "won_value", group: "revenue", label: "Accepted value this week", getValue: (d) => ({ value: d.revenue.acceptedValueThisWeek }) },
  { key: "delivered_value", group: "revenue", label: "Delivered value this week", getValue: (d) => ({ value: d.revenue.deliveredValueThisWeek }) },
  { key: "proposals_sent", group: "trends", label: "Proposals sent", getValue: (d) => ({ value: d.conversion.counts.proposalSent }) },
  { key: "accepted_count", group: "trends", label: "Accepted", getValue: (d) => ({ value: d.conversion.counts.accepted }) },
  { key: "delivery_completed", group: "trends", label: "Delivery completed", getValue: (d) => ({ value: d.conversion.counts.deliveryCompleted }) },
  { key: "proof_created", group: "trends", label: "Proof created", getValue: (d) => ({ value: d.conversion.counts.proofCreated }) },
  { key: "intake_count", group: "trends", label: "Intake count", getValue: (d) => ({ value: d.conversion.counts.intake }) },
  { key: "handoffs_completed", group: "trends", label: "Handoffs completed", getValue: (d) => ({ value: d.handoffsCompleted ?? 0 }) },
  { key: "testimonials_received", group: "trends", label: "Testimonials received", getValue: (d) => ({ value: d.testimonialsReceived ?? 0 }) },
];

export type CaptureMetricsSnapshotResult = {
  weekStart: string;
  metricsWritten: number;
};

export async function captureMetricsSnapshot(weekStartOverride?: Date): Promise<CaptureMetricsSnapshotResult> {
  const now = weekStartOverride ?? new Date();
  const weekStart = getWeekStart(now);

  const [convInput, cycleInput, revInput, sourceInput, handoffsCompleted, testimonialsReceived] = await Promise.all([
    fetchConversionInput("this_week"),
    fetchCycleTimeInput("this_week"),
    fetchRevenueInput("this_week"),
    fetchSourcePerformanceInput("this_week"),
    (() => {
      const we = new Date(weekStart);
      we.setDate(we.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      return db.deliveryProject.count({
        where: {
          status: { in: ["completed", "archived"] },
          handoffCompletedAt: { gte: weekStart, lte: we },
        },
      });
    })(),
    (() => {
      const we = new Date(weekStart);
      we.setDate(we.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      return db.deliveryProject.count({
        where: {
          status: { in: ["completed", "archived"] },
          testimonialReceivedAt: { gte: weekStart, lte: we },
        },
      });
    })(),
  ]);

  const conversion = computeConversionMetrics(convInput);
  const cycleTimes = computeCycleTimeMetrics(cycleInput);
  const revenue = computeRevenueMetrics(revInput);
  const source = computeSourcePerformance(sourceInput);

  const data = {
    conversion,
    cycleTimes,
    revenue,
    source,
    handoffsCompleted: handoffsCompleted ?? 0,
    testimonialsReceived: testimonialsReceived ?? 0,
  };
  let written = 0;

  for (const m of METRICS_TO_SNAPSHOT) {
    const { value, count } = m.getValue(data);
    const metricValue = Number.isFinite(value) ? value : 0;
    await db.weeklyMetricSnapshot.upsert({
      where: { weekStart_metricKey: { weekStart, metricKey: m.key } },
      create: {
        weekStart,
        metricKey: m.key,
        metricGroup: m.group,
        metricLabel: m.label,
        metricValue,
        metricCount: count ?? null,
      },
      update: {
        metricGroup: m.group,
        metricLabel: m.label,
        metricValue,
        metricCount: count ?? undefined,
      },
    });
    written++;
  }

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    metricsWritten: written,
  };
}
