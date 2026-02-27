/**
 * Phase 2.3: Shared data fetchers for metrics APIs.
 * Null-safe, empty-db safe. Uses IntakeLead + Proposal + DeliveryProject.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getRangeBounds, type MetricsRange } from "./date-range";

export async function fetchConversionInput(range: MetricsRange) {
  const now = new Date();
  const bounds = getRangeBounds(range, now);
  const createdAtFilter = bounds.start && bounds.end
    ? { createdAt: { gte: bounds.start, lte: bounds.end } as Prisma.DateTimeFilter }
    : {};

  const [
    intakeLeadCount,
    pipelineLeadCount,
    promotedCount,
    proposalCreatedCount,
    proposalSentCount,
    acceptedCount,
    deliveryStartedCount,
    deliveryCompletedCount,
    proofCreatedCount,
  ] = await Promise.all([
    db.intakeLead.count({ where: createdAtFilter }),
    db.lead.count({
      where: {
        ...createdAtFilter,
        promotedFromIntake: { is: null },
      },
    }),
    db.intakeLead.count({
      where: {
        ...createdAtFilter,
        promotedLeadId: { not: null },
      },
    }),
    db.proposal.count({
      where: bounds.start && bounds.end
        ? { createdAt: { gte: bounds.start, lte: bounds.end } }
        : {},
    }),
    db.proposal.count({
      where: bounds.start && bounds.end
        ? { sentAt: { gte: bounds.start, lte: bounds.end } }
        : { sentAt: { not: null } },
    }),
    db.proposal.count({
      where: bounds.start && bounds.end
        ? { acceptedAt: { gte: bounds.start, lte: bounds.end } }
        : { acceptedAt: { not: null } },
    }),
    db.deliveryProject.count({
      where: bounds.start && bounds.end
        ? { startDate: { gte: bounds.start, lte: bounds.end } }
        : { startDate: { not: null } },
    }),
    db.deliveryProject.count({
      where: bounds.start && bounds.end
        ? { completedAt: { gte: bounds.start, lte: bounds.end } }
        : { completedAt: { not: null } },
    }),
    db.proofRecord.count({
      where: bounds.start && bounds.end
        ? { createdAt: { gte: bounds.start, lte: bounds.end } }
        : {},
    }),
  ]);

  const intakeCount = (intakeLeadCount ?? 0) + (pipelineLeadCount ?? 0);
  const promotedCountTotal = (promotedCount ?? 0) + (pipelineLeadCount ?? 0);

  return {
    intakeCount,
    promotedCount: promotedCountTotal,
    proposalCreatedCount: proposalCreatedCount ?? 0,
    proposalSentCount: proposalSentCount ?? 0,
    acceptedCount: acceptedCount ?? 0,
    deliveryStartedCount: deliveryStartedCount ?? 0,
    deliveryCompletedCount: deliveryCompletedCount ?? 0,
    proofCreatedCount: proofCreatedCount ?? 0,
  };
}

export async function fetchCycleTimeInput(range: MetricsRange) {
  const now = new Date();
  const bounds = getRangeBounds(range, now);
  const proposalWhere = bounds.start && bounds.end
    ? {
        OR: [
          { acceptedAt: { gte: bounds.start, lte: bounds.end } },
          { sentAt: { gte: bounds.start, lte: bounds.end } },
          { createdAt: { gte: bounds.start, lte: bounds.end } },
        ],
      }
    : {};
  const deliveryWhere = bounds.start && bounds.end
    ? {
        OR: [
          { startDate: { gte: bounds.start, lte: bounds.end } },
          { completedAt: { gte: bounds.start, lte: bounds.end } },
          { handoffCompletedAt: { gte: bounds.start, lte: bounds.end } },
        ],
      }
    : {};

  const [proposals, deliveryProjects] = await Promise.all([
    db.proposal.findMany({
      where: proposalWhere,
      select: {
        createdAt: true,
        sentAt: true,
        acceptedAt: true,
        deliveryProjects: {
          select: { startDate: true, completedAt: true, handoffCompletedAt: true, clientConfirmedAt: true, proofCapturedAt: true },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.deliveryProject.findMany({
      where: deliveryWhere,
      select: {
        startDate: true,
        completedAt: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
        proofCapturedAt: true,
        proposal: { select: { acceptedAt: true } },
      },
    }),
  ]);

  const proposalCreateToSent = proposals
    .filter((p) => p.sentAt)
    .map((p) => ({ createdAt: p.createdAt, sentAt: p.sentAt }));
  const proposalSentToAccepted = proposals
    .filter((p) => p.sentAt && p.acceptedAt)
    .map((p) => ({ sentAt: p.sentAt, acceptedAt: p.acceptedAt }));
  const acceptedToDeliveryStart = deliveryProjects
    .filter((d) => d.proposal?.acceptedAt && d.startDate)
    .map((d) => ({ acceptedAt: d.proposal!.acceptedAt, deliveryStartDate: d.startDate }));
  const deliveryStartToComplete = deliveryProjects
    .filter((d) => d.startDate && d.completedAt)
    .map((d) => ({ startDate: d.startDate, completedAt: d.completedAt }));
  const completeToHandoff = deliveryProjects
    .filter((d) => d.completedAt && d.handoffCompletedAt)
    .map((d) => ({ completedAt: d.completedAt, handoffCompletedAt: d.handoffCompletedAt }));
  const handoffToClientConfirm = deliveryProjects
    .filter((d) => d.handoffCompletedAt && d.clientConfirmedAt)
    .map((d) => ({ handoffCompletedAt: d.handoffCompletedAt, clientConfirmedAt: d.clientConfirmedAt }));
  const completeToProofCandidate = deliveryProjects
    .filter((d) => d.completedAt && d.proofCapturedAt)
    .map((d) => ({ completedAt: d.completedAt, proofCapturedAt: d.proofCapturedAt }));

  return {
    proposalCreateToSent,
    proposalSentToAccepted,
    acceptedToDeliveryStart,
    deliveryStartToComplete,
    completeToHandoff,
    handoffToClientConfirm,
    completeToProofCandidate,
  };
}

export async function fetchRevenueInput(range: MetricsRange) {
  const now = new Date();
  const bounds = getRangeBounds(range, now);
  const weekStart = bounds.start ?? new Date(0);
  const weekEnd = bounds.end ?? new Date(8640000000000000);

  const [proposals, deliveryProjects, retainerCount] = await Promise.all([
    db.proposal.findMany({
      where: { acceptedAt: { not: null } },
      select: { finalValue: true, priceMin: true, priceMax: true, acceptedAt: true },
    }),
    db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        finalValue: true,
        completedAt: true,
        upsellValueEstimate: true,
        retentionStatus: true,
        proposal: { select: { finalValue: true, priceMin: true, priceMax: true } },
      },
    }),
    db.deliveryProject.count({
      where: { retentionStatus: "retainer_open" },
    }),
  ]);

  const upsellOpenValue = deliveryProjects
    .filter((d) => d.retentionStatus === "upsell_open" && d.upsellValueEstimate != null)
    .reduce((s, d) => s + (d.upsellValueEstimate ?? 0), 0);

  return {
    weekStart,
    weekEnd,
    proposals: proposals ?? [],
    deliveryProjects: deliveryProjects ?? [],
    upsellOpenValue: Number.isFinite(upsellOpenValue) ? upsellOpenValue : 0,
    retainerOpenCount: retainerCount ?? 0,
  };
}

export async function fetchSourcePerformanceInput(range: MetricsRange) {
  const now = new Date();
  const bounds = getRangeBounds(range, now);
  const createdAtFilter = bounds.start && bounds.end
    ? { createdAt: { gte: bounds.start, lte: bounds.end } }
    : {};

  const leads = await db.intakeLead.findMany({
    where: createdAtFilter,
    select: {
      source: true,
      promotedLeadId: true,
      proposals: { select: { id: true, status: true, sentAt: true, acceptedAt: true, finalValue: true, priceMin: true, priceMax: true } },
      deliveryProjects: { select: { id: true, status: true, completedAt: true, finalValue: true, proposal: { select: { finalValue: true, priceMin: true, priceMax: true } } } },
    },
  });

  const bySource = new Map<
    string,
    { intakeCount: number; promotedCount: number; proposalCount: number; sentCount: number; acceptedCount: number; deliveredCount: number; revenue: number }
  >();

  function proposalValue(p: { finalValue?: number | null; priceMin?: number | null; priceMax?: number | null }): number {
    const fv = p.finalValue;
    if (fv != null && Number.isFinite(fv) && fv >= 0) return fv;
    const min = p.priceMin ?? 0;
    const max = p.priceMax ?? 0;
    if (Number.isFinite(min) && Number.isFinite(max) && max > 0) return (min + max) / 2;
    if (Number.isFinite(min) && min > 0) return min;
    if (Number.isFinite(max) && max > 0) return max;
    return 0;
  }

  for (const l of leads) {
    const src = l.source ?? "unknown";
    let row = bySource.get(src);
    if (!row) {
      row = { intakeCount: 0, promotedCount: 0, proposalCount: 0, sentCount: 0, acceptedCount: 0, deliveredCount: 0, revenue: 0 };
      bySource.set(src, row);
    }
    row.intakeCount++;
    if (l.promotedLeadId) row.promotedCount++;
    row.proposalCount += l.proposals?.length ?? 0;
    for (const p of l.proposals ?? []) {
      if (p.sentAt) row.sentCount++;
      if (p.acceptedAt) {
        row.acceptedCount++;
        row.revenue += proposalValue(p);
      }
    }
    for (const d of l.deliveryProjects ?? []) {
      if (d.status === "completed" || d.status === "archived") {
        row.deliveredCount++;
      }
    }
  }

  return {
    rows: Array.from(bySource.entries()).map(([source, r]) => ({ source, ...r })),
  };
}
