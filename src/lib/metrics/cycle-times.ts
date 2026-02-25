/**
 * Phase 2.3: Cycle time metrics helpers.
 * Null-safe, invalid-date safe.
 */

export type CycleTimeInput = {
  proposalCreateToSent: { createdAt: Date | string | null; sentAt: Date | string | null }[];
  proposalSentToAccepted: { sentAt: Date | string | null; acceptedAt: Date | string | null }[];
  acceptedToDeliveryStart: { acceptedAt: Date | string | null; deliveryStartDate: Date | string | null }[];
  deliveryStartToComplete: { startDate: Date | string | null; completedAt: Date | string | null }[];
  completeToHandoff: { completedAt: Date | string | null; handoffCompletedAt: Date | string | null }[];
  handoffToClientConfirm: { handoffCompletedAt: Date | string | null; clientConfirmedAt: Date | string | null }[];
  completeToProofCandidate: { completedAt: Date | string | null; proofCapturedAt: Date | string | null }[];
};

export type CycleTimeMetrics = {
  proposalCreateToSentAvgDays: number;
  proposalSentToAcceptedAvgDays: number;
  acceptedToDeliveryStartAvgDays: number;
  deliveryStartToCompleteAvgDays: number;
  completeToHandoffAvgDays: number;
  handoffToClientConfirmAvgDays: number;
  completeToProofCandidateAvgDays: number;
  counts: Record<string, number>;
};

function parseDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

/**
 * Safe days between two dates. Returns null if either invalid.
 */
export function daysBetween(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number | null {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return null;
  const ms = db.getTime() - da.getTime();
  if (!Number.isFinite(ms)) return null;
  return ms / 86400000;
}

function avgDays(pairs: { a: Date | string | null; b: Date | string | null }[]): { avg: number; count: number } {
  const days: number[] = [];
  for (const p of pairs) {
    const d = daysBetween(p.a, p.b);
    if (d != null && d >= 0 && Number.isFinite(d)) days.push(d);
  }
  if (days.length === 0) return { avg: 0, count: 0 };
  const sum = days.reduce((s, x) => s + x, 0);
  return { avg: sum / days.length, count: days.length };
}

export function computeCycleTimeMetrics(input: Partial<CycleTimeInput> = {}): CycleTimeMetrics {
  const ct1 = avgDays(
    (input.proposalCreateToSent ?? []).map((p) => ({ a: p.createdAt, b: p.sentAt }))
  );
  const ct2 = avgDays(
    (input.proposalSentToAccepted ?? []).map((p) => ({ a: p.sentAt, b: p.acceptedAt }))
  );
  const ct3 = avgDays(
    (input.acceptedToDeliveryStart ?? []).map((p) => ({ a: p.acceptedAt, b: p.deliveryStartDate }))
  );
  const ct4 = avgDays(
    (input.deliveryStartToComplete ?? []).map((p) => ({ a: p.startDate, b: p.completedAt }))
  );
  const ct5 = avgDays(
    (input.completeToHandoff ?? []).map((p) => ({ a: p.completedAt, b: p.handoffCompletedAt }))
  );
  const ct6 = avgDays(
    (input.handoffToClientConfirm ?? []).map((p) => ({ a: p.handoffCompletedAt, b: p.clientConfirmedAt }))
  );
  const ct7 = avgDays(
    (input.completeToProofCandidate ?? []).map((p) => ({ a: p.completedAt, b: p.proofCapturedAt }))
  );

  return {
    proposalCreateToSentAvgDays: Number.isFinite(ct1.avg) ? ct1.avg : 0,
    proposalSentToAcceptedAvgDays: Number.isFinite(ct2.avg) ? ct2.avg : 0,
    acceptedToDeliveryStartAvgDays: Number.isFinite(ct3.avg) ? ct3.avg : 0,
    deliveryStartToCompleteAvgDays: Number.isFinite(ct4.avg) ? ct4.avg : 0,
    completeToHandoffAvgDays: Number.isFinite(ct5.avg) ? ct5.avg : 0,
    handoffToClientConfirmAvgDays: Number.isFinite(ct6.avg) ? ct6.avg : 0,
    completeToProofCandidateAvgDays: Number.isFinite(ct7.avg) ? ct7.avg : 0,
    counts: {
      proposalCreateToSent: ct1.count,
      proposalSentToAccepted: ct2.count,
      acceptedToDeliveryStart: ct3.count,
      deliveryStartToComplete: ct4.count,
      completeToHandoff: ct5.count,
      handoffToClientConfirm: ct6.count,
      completeToProofCandidate: ct7.count,
    },
  };
}
