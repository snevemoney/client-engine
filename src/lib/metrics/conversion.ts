/**
 * Phase 2.3: Conversion metrics helpers.
 * Null-safe, zero-denominator safe.
 */

export type ConversionInput = {
  intakeCount?: number;
  promotedCount?: number;
  proposalCreatedCount?: number;
  proposalSentCount?: number;
  acceptedCount?: number;
  deliveryStartedCount?: number;
  deliveryCompletedCount?: number;
  proofCreatedCount?: number;
};

export type ConversionMetrics = {
  intakeToPromotedRate: number;
  promotedToProposalRate: number;
  proposalSentToAcceptedRate: number;
  acceptedToDeliveryStartedRate: number;
  deliveryCompletedToProofRate: number;
  counts: {
    intake: number;
    promoted: number;
    proposalCreated: number;
    proposalSent: number;
    accepted: number;
    deliveryStarted: number;
    deliveryCompleted: number;
    proofCreated: number;
  };
};

function safeRate(num: number, denom: number): number {
  if (denom <= 0 || !Number.isFinite(denom)) return 0;
  const r = num / denom;
  return Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
}

/**
 * Compute conversion rates from stage counts.
 * Zero denominators return 0, never NaN.
 */
export function computeConversionMetrics(input: ConversionInput = {}): ConversionMetrics {
  const intake = input.intakeCount ?? 0;
  const promoted = input.promotedCount ?? 0;
  const proposalCreated = input.proposalCreatedCount ?? 0;
  const proposalSent = input.proposalSentCount ?? 0;
  const accepted = input.acceptedCount ?? 0;
  const deliveryStarted = input.deliveryStartedCount ?? 0;
  const deliveryCompleted = input.deliveryCompletedCount ?? 0;
  const proofCreated = input.proofCreatedCount ?? 0;

  return {
    intakeToPromotedRate: safeRate(promoted, intake),
    promotedToProposalRate: safeRate(proposalCreated, promoted),
    proposalSentToAcceptedRate: safeRate(accepted, proposalSent),
    acceptedToDeliveryStartedRate: safeRate(deliveryStarted, accepted),
    deliveryCompletedToProofRate: safeRate(proofCreated, deliveryCompleted),
    counts: {
      intake,
      promoted,
      proposalCreated,
      proposalSent,
      accepted,
      deliveryStarted,
      deliveryCompleted,
      proofCreated,
    },
  };
}
