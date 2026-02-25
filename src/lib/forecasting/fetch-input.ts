/**
 * Phase 2.4: Fetch forecast input from DB.
 */

import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "@/lib/operator-score/trends";
import type { ForecastInput } from "./forecast";

export async function fetchWeeklyForecastInput(now: Date = new Date()): Promise<ForecastInput> {
  const weekStart = getWeekStart(now);
  const endOfWeek = new Date(weekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [
    proposalsSent,
    acceptedCount,
    deliveryCompletedCount,
    proofCreatedCount,
    handoffsCompletedCount,
    testimonialsReceivedCount,
    acceptedValue,
    deliveredValue,
    strategyWeek,
    strategyTargets,
  ] = await Promise.all([
    db.proposal.count({
      where: { sentAt: { gte: weekStart, lte: endOfWeek } },
    }),
    db.proposal.count({
      where: { acceptedAt: { gte: weekStart, lte: endOfWeek } },
    }),
    db.deliveryProject.count({
      where: { completedAt: { gte: weekStart, lte: endOfWeek } },
    }),
    db.proofRecord.count({
      where: { createdAt: { gte: weekStart, lte: endOfWeek } },
    }),
    db.deliveryProject.count({
      where: { handoffCompletedAt: { gte: weekStart, lte: endOfWeek } },
    }),
    db.deliveryProject.count({
      where: { testimonialReceivedAt: { gte: weekStart, lte: endOfWeek } },
    }),
    (async () => {
      const proposals = await db.proposal.findMany({
        where: { acceptedAt: { gte: weekStart, lte: endOfWeek } },
        select: { finalValue: true, priceMin: true, priceMax: true },
      });
      return proposals.reduce((s, p) => {
        const v = p.finalValue ?? (p.priceMin != null && p.priceMax != null ? (p.priceMin + p.priceMax) / 2 : 0);
        return s + (Number.isFinite(v) ? v : 0);
      }, 0);
    })(),
    (async () => {
      const projects = await db.deliveryProject.findMany({
        where: { completedAt: { gte: weekStart, lte: endOfWeek } },
        select: {
          finalValue: true,
          proposal: { select: { finalValue: true, priceMin: true, priceMax: true } },
        },
      });
      return projects.reduce((s, d) => {
        const v =
          d.finalValue ??
          (d.proposal?.finalValue ??
            (d.proposal?.priceMin != null && d.proposal?.priceMax != null
              ? (d.proposal.priceMin + d.proposal.priceMax) / 2
              : 0));
        return s + (Number.isFinite(v) ? v : 0);
      }, 0);
    })(),
    db.strategyWeek.findUnique({
      where: { weekStart },
      select: { weeklyTargetValue: true, weeklyTargetUnit: true },
    }),
    db.strategyWeekTarget.findMany({
      where: { strategyWeek: { weekStart } },
      select: { category: true, name: true, targetValue: true, unit: true },
    }),
  ]);

  let targetProposalsSent: number | null = null;
  const targetAccepted: number | null = null;
  let targetAcceptedValue: number | null = strategyWeek?.weeklyTargetValue ? Number(strategyWeek.weeklyTargetValue) : null;
  let targetDeliveredValue: number | null = null;

  for (const t of strategyTargets ?? []) {
    const val = Number(t.targetValue);
    if (t.category === "proposals" && t.unit === "count") targetProposalsSent = val;
    if (t.category === "revenue" && (t.unit === "$" || t.unit === "value")) targetAcceptedValue = val;
    if (t.name?.toLowerCase().includes("delivered") && (t.unit === "$" || t.unit === "value")) targetDeliveredValue = val;
  }

  return {
    periodType: "weekly",
    periodStart: weekStart,
    periodEnd: endOfWeek,
    now,
    proposalsSent: proposalsSent ?? 0,
    acceptedCount: acceptedCount ?? 0,
    deliveryCompletedCount: deliveryCompletedCount ?? 0,
    proofCreatedCount: proofCreatedCount ?? 0,
    handoffsCompletedCount: handoffsCompletedCount ?? 0,
    testimonialsReceivedCount: testimonialsReceivedCount ?? 0,
    acceptedValue: acceptedValue ?? 0,
    deliveredValue: deliveredValue ?? 0,
    targetProposalsSent: targetProposalsSent ?? null,
    targetAccepted: targetAccepted ?? null,
    targetAcceptedValue,
    targetDeliveredValue: targetDeliveredValue ?? null,
  };
}

export async function fetchMonthlyForecastInput(now: Date = new Date()): Promise<ForecastInput> {
  const monthStart = getMonthStart(now);
  const endOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);

  const [
    proposalsSent,
    acceptedCount,
    deliveryCompletedCount,
    proofCreatedCount,
    handoffsCompletedCount,
    testimonialsReceivedCount,
    acceptedValue,
    deliveredValue,
  ] = await Promise.all([
    db.proposal.count({
      where: { sentAt: { gte: monthStart, lte: endOfMonth } },
    }),
    db.proposal.count({
      where: { acceptedAt: { gte: monthStart, lte: endOfMonth } },
    }),
    db.deliveryProject.count({
      where: { completedAt: { gte: monthStart, lte: endOfMonth } },
    }),
    db.proofRecord.count({
      where: { createdAt: { gte: monthStart, lte: endOfMonth } },
    }),
    db.deliveryProject.count({
      where: { handoffCompletedAt: { gte: monthStart, lte: endOfMonth } },
    }),
    db.deliveryProject.count({
      where: { testimonialReceivedAt: { gte: monthStart, lte: endOfMonth } },
    }),
    (async () => {
      const proposals = await db.proposal.findMany({
        where: { acceptedAt: { gte: monthStart, lte: endOfMonth } },
        select: { finalValue: true, priceMin: true, priceMax: true },
      });
      return proposals.reduce((s, p) => {
        const v = p.finalValue ?? (p.priceMin != null && p.priceMax != null ? (p.priceMin + p.priceMax) / 2 : 0);
        return s + (Number.isFinite(v) ? v : 0);
      }, 0);
    })(),
    (async () => {
      const projects = await db.deliveryProject.findMany({
        where: { completedAt: { gte: monthStart, lte: endOfMonth } },
        select: {
          finalValue: true,
          proposal: { select: { finalValue: true, priceMin: true, priceMax: true } },
        },
      });
      return projects.reduce((s, d) => {
        const v =
          d.finalValue ??
          (d.proposal?.finalValue ??
            (d.proposal?.priceMin != null && d.proposal?.priceMax != null
              ? (d.proposal.priceMin + d.proposal.priceMax) / 2
              : 0));
        return s + (Number.isFinite(v) ? v : 0);
      }, 0);
    })(),
  ]);

  return {
    periodType: "monthly",
    periodStart: monthStart,
    periodEnd: endOfMonth,
    now,
    proposalsSent: proposalsSent ?? 0,
    acceptedCount: acceptedCount ?? 0,
    deliveryCompletedCount: deliveryCompletedCount ?? 0,
    proofCreatedCount: proofCreatedCount ?? 0,
    handoffsCompletedCount: handoffsCompletedCount ?? 0,
    testimonialsReceivedCount: testimonialsReceivedCount ?? 0,
    acceptedValue: acceptedValue ?? 0,
    deliveredValue: deliveredValue ?? 0,
    targetProposalsSent: null,
    targetAccepted: null,
    targetAcceptedValue: null,
    targetDeliveredValue: null,
  };
}
