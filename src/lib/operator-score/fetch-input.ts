/**
 * Phase 2.4: Fetch operator score input from DB.
 * Aggregates bottlenecks, conversion, delivery, proof, cadence.
 */

import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/weekStart";
import { getMonthStart } from "./trends";
import { fetchConversionInput } from "@/lib/metrics/fetch-metrics";
import { computeConversionMetrics } from "@/lib/metrics/conversion";
import { fetchBottlenecks } from "@/lib/metrics/bottlenecks";
import type { OperatorScoreInput } from "./score";

export async function fetchOperatorScoreInput(periodType: "weekly" | "monthly"): Promise<OperatorScoreInput> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);
  const endOfWeek = new Date(weekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const endOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);

  const periodStart = periodType === "weekly" ? weekStart : monthStart;
  const periodEnd = periodType === "weekly" ? endOfWeek : endOfMonth;

  const [
    convInput,
    bottlenecks,
    proposalGaps,
    deliveryProjects,
    completedProjects,
    proofCandidateReady,
    wonMissingProof,
    strategyWeek,
    weeklyMetricSnapshot,
    operatorScoreSnapshot,
  ] = await Promise.all([
    fetchConversionInput("this_week"),
    fetchBottlenecks(),
    (async () => {
      const [readyNotSent, sentProposals] = await Promise.all([
        db.proposal.count({ where: { status: "ready" } }),
        db.proposal.findMany({
          where: {
            status: { in: ["sent", "viewed"] },
            acceptedAt: null,
            rejectedAt: null,
          },
          select: {
            nextFollowUpAt: true,
            sentAt: true,
            respondedAt: true,
            staleAfterDays: true,
          },
        }),
      ]);
      let sentNoFollowup = 0;
      let followupOverdue = 0;
      let stale = 0;
      const startToday = new Date(now);
      startToday.setHours(0, 0, 0, 0);
      for (const p of sentProposals ?? []) {
        if (!p.nextFollowUpAt) sentNoFollowup++;
        else if (p.nextFollowUpAt < startToday) followupOverdue++;
        const threshold = p.staleAfterDays ?? 7;
        if (p.sentAt && !p.respondedAt) {
          const daysSince = Math.floor((now.getTime() - p.sentAt.getTime()) / 86400000);
          if (daysSince >= threshold) stale++;
        }
      }
      return {
        readyNotSent: readyNotSent ?? 0,
        sentNoFollowup,
        followupOverdue,
        staleProposals: stale,
      };
    })(),
    db.deliveryProject.findMany({
      where: { status: { notIn: ["archived"] } },
      select: { status: true, dueDate: true, handoffStartedAt: true, handoffCompletedAt: true, clientConfirmedAt: true },
    }),
    db.deliveryProject.findMany({
      where: { status: { in: ["completed", "archived"] } },
      select: {
        handoffStartedAt: true,
        handoffCompletedAt: true,
        clientConfirmedAt: true,
        testimonialRequestedAt: true,
        proofCandidateId: true,
      },
    }),
    db.proofCandidate.count({ where: { status: "ready" } }),
    db.intakeLead.count({
      where: {
        status: "won",
        proofCandidates: { none: {} },
        proofRecords: { none: {} },
      },
    }),
    db.strategyWeek.findUnique({
      where: { weekStart },
      include: { review: true, priorities: true },
    }),
    db.weeklyMetricSnapshot.findFirst({
      where: { weekStart },
    }),
    db.operatorScoreSnapshot.findFirst({
      where: { periodType: "weekly", periodStart: weekStart },
    }),
  ]);

  const conversion = computeConversionMetrics(convInput);

  let deliveryOverdue = 0;
  for (const p of deliveryProjects ?? []) {
    if (p.dueDate && new Date(p.dueDate).getTime() < now.getTime()) deliveryOverdue++;
  }

  let completedNoHandoff = 0;
  let handoffNoClientConfirm = 0;
  let completedNoTestimonialRequest = 0;
  let completedNoProof = 0;
  const totalCompleted = (completedProjects ?? []).length || 1;
  for (const p of completedProjects ?? []) {
    const hasHandoff = !!p.handoffCompletedAt || !!p.handoffStartedAt;
    if (!hasHandoff) completedNoHandoff++;
    else if (!p.clientConfirmedAt) handoffNoClientConfirm++;
    if (!p.testimonialRequestedAt) completedNoTestimonialRequest++;
    if (!p.proofCandidateId) completedNoProof++;
  }

  const reviewCompleted =
    periodType === "weekly"
      ? !!strategyWeek?.review?.completedAt &&
        strategyWeek.review.completedAt >= periodStart &&
        strategyWeek.review.completedAt <= periodEnd
      : false;

  const prioritiesUpdated =
    periodType === "weekly"
      ? (strategyWeek?.priorities?.length ?? 0) > 0
      : false;

  const metricsSnapshotCaptured = !!weeklyMetricSnapshot;
  const operatorScoreSnapshotCaptured = !!operatorScoreSnapshot;

  return {
    readyNotSent: proposalGaps.readyNotSent,
    sentNoFollowup: proposalGaps.sentNoFollowup,
    followupOverdue: proposalGaps.followupOverdue,
    staleProposals: proposalGaps.staleProposals,
    proposalSentToAcceptedRate: conversion.proposalSentToAcceptedRate,
    acceptedToDeliveryStartedRate: conversion.acceptedToDeliveryStartedRate,
    deliveryCompletedToProofRate: conversion.deliveryCompletedToProofRate,
    deliveryOverdue,
    completedNoHandoff,
    handoffNoClientConfirm,
    totalCompleted,
    proofCandidatesReadyPending: proofCandidateReady ?? 0,
    wonMissingProof: wonMissingProof ?? 0,
    completedNoTestimonialRequest,
    completedNoProof,
    totalCompletedForProof: totalCompleted,
    reviewCompletedThisWeek: reviewCompleted,
    prioritiesUpdated,
    metricsSnapshotCaptured: !!weeklyMetricSnapshot,
    operatorScoreSnapshotCaptured,
  };
}
