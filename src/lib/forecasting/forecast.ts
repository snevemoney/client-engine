/**
 * Phase 2.4: Pace-based weekly and monthly forecasts.
 * Uses existing metrics; no ML.
 */

import {
  projectCount,
  projectValue,
  classifyConfidence,
  compareToTarget,
  type ConfidenceLevel,
  type PaceStatus,
} from "./pace";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "@/lib/operator-score/trends";

export type ForecastMetric = {
  key: string;
  label: string;
  actual: number;
  projected: number;
  target: number | null;
  status: PaceStatus;
  confidence: ConfidenceLevel;
  unit: "count" | "value";
};

export type ForecastPeriod = {
  periodType: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  elapsedDays: number;
  totalDays: number;
  metrics: ForecastMetric[];
  warnings: string[];
};

export type ForecastInput = {
  periodType: "weekly" | "monthly";
  periodStart: Date;
  periodEnd: Date;
  now: Date;
  // Counts (actual so far)
  proposalsSent?: number;
  acceptedCount?: number;
  deliveryCompletedCount?: number;
  proofCreatedCount?: number;
  handoffsCompletedCount?: number;
  testimonialsReceivedCount?: number;
  acceptedValue?: number;
  deliveredValue?: number;
  // Targets (optional)
  targetProposalsSent?: number | null;
  targetAccepted?: number | null;
  targetDeliveredValue?: number | null;
  targetAcceptedValue?: number | null;
};

function buildMetrics(
  input: ForecastInput,
  elapsedDays: number,
  totalDays: number
): ForecastMetric[] {
  const metrics: ForecastMetric[] = [];
  const conf = classifyConfidence(elapsedDays, totalDays);

  const addCount = (
    key: string,
    label: string,
    actual: number,
    target?: number | null
  ) => {
    const projected = projectCount(actual, elapsedDays, totalDays);
    const { status } = compareToTarget(projected, target);
    metrics.push({
      key,
      label,
      actual: Number.isFinite(actual) ? actual : 0,
      projected,
      target: target != null && Number.isFinite(target) ? target : null,
      status,
      confidence: conf,
      unit: "count",
    });
  };

  const addValue = (
    key: string,
    label: string,
    actual: number,
    target?: number | null
  ) => {
    const projected = projectValue(actual, elapsedDays, totalDays);
    const { status } = compareToTarget(projected, target);
    metrics.push({
      key,
      label,
      actual: Number.isFinite(actual) ? actual : 0,
      projected,
      target: target != null && Number.isFinite(target) ? target : null,
      status,
      confidence: conf,
      unit: "value",
    });
  };

  addCount("proposals_sent", "Proposals sent", input.proposalsSent ?? 0, input.targetProposalsSent);
  addCount("accepted", "Accepted", input.acceptedCount ?? 0, input.targetAccepted);
  addCount("delivery_completed", "Deliveries completed", input.deliveryCompletedCount ?? 0);
  addCount("proof_created", "Proof created", input.proofCreatedCount ?? 0);
  addCount("handoffs_completed", "Handoffs completed", input.handoffsCompletedCount ?? 0);
  addCount("testimonials_received", "Testimonials received", input.testimonialsReceivedCount ?? 0);
  addValue("accepted_value", "Accepted value", input.acceptedValue ?? 0, input.targetAcceptedValue);
  addValue("delivered_value", "Delivered value", input.deliveredValue ?? 0, input.targetDeliveredValue);

  return metrics;
}

function buildWarnings(metrics: ForecastMetric[]): string[] {
  const warnings: string[] = [];
  const behind = metrics.filter((m) => m.status === "behind");
  if (behind.length > 0) {
    warnings.push(`Behind pace on ${behind.map((m) => m.label).join(", ")}`);
  }
  const lowConf = metrics.filter((m) => m.confidence === "low");
  if (lowConf.length === metrics.length && metrics.length > 0) {
    warnings.push("Low confidence: early in period");
  }
  return warnings;
}

export function computeWeeklyForecast(input: Omit<ForecastInput, "periodType">): ForecastPeriod {
  const periodStart = getWeekStart(input.now);
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 6);
  periodEnd.setHours(23, 59, 59, 999);

  const elapsedMs = input.now.getTime() - periodStart.getTime();
  const elapsedDays = Math.max(0, Math.min(7, elapsedMs / 86400000));
  const totalDays = 7;

  const metrics = buildMetrics(
    { ...input, periodType: "weekly", periodStart, periodEnd },
    elapsedDays,
    totalDays
  );
  const warnings = buildWarnings(metrics);

  return {
    periodType: "weekly",
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    elapsedDays: Number.isFinite(elapsedDays) ? elapsedDays : 0,
    totalDays,
    metrics,
    warnings,
  };
}

export function computeMonthlyForecast(input: Omit<ForecastInput, "periodType">): ForecastPeriod {
  const periodStart = getMonthStart(input.now);
  const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59, 999);

  const elapsedMs = input.now.getTime() - periodStart.getTime();
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  const elapsedDays = Math.max(0, elapsedMs / 86400000);
  const totalDays = Math.max(1, totalMs / 86400000);

  const metrics = buildMetrics(
    { ...input, periodType: "monthly", periodStart, periodEnd },
    elapsedDays,
    totalDays
  );
  const warnings = buildWarnings(metrics);

  return {
    periodType: "monthly",
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    elapsedDays: Number.isFinite(elapsedDays) ? elapsedDays : 0,
    totalDays: Number.isFinite(totalDays) ? totalDays : 30,
    metrics,
    warnings,
  };
}
