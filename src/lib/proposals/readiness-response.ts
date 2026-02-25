/**
 * Phase 2.1: Proposal response & follow-up action readiness.
 * Lightweight, safe.
 */

export type ProposalLike = {
  status?: string | null;
  sentAt?: Date | string | null;
  viewedAt?: Date | string | null;
  respondedAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  meetingBookedAt?: Date | string | null;
  nextFollowUpAt?: Date | string | null;
};

export type ProposalResponseReadinessResult = {
  canMarkSent: boolean;
  canLogResponse: boolean;
  canBookMeeting: boolean;
  warnings: string[];
};

function parseDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === "string") {
    const d = new Date(input.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Compute which response/follow-up actions are available.
 */
export function computeProposalResponseReadiness(
  proposal: ProposalLike
): ProposalResponseReadinessResult {
  const warnings: string[] = [];
  const status = (proposal.status ?? "").toLowerCase();
  const sentAt = parseDate(proposal.sentAt);
  const acceptedAt = parseDate(proposal.acceptedAt);
  const rejectedAt = parseDate(proposal.rejectedAt);
  const meetingBookedAt = parseDate(proposal.meetingBookedAt);

  const isSent = status === "sent" || status === "viewed";
  const isClosed = !!(acceptedAt || rejectedAt);

  const canMarkSent = status === "ready" && !sentAt;
  const canLogResponse = isSent && !isClosed;
  const canBookMeeting = isSent && !isClosed && !meetingBookedAt;

  if (isSent && !proposal.respondedAt && !proposal.viewedAt) {
    warnings.push("No response logged yet");
  }

  return {
    canMarkSent,
    canLogResponse,
    canBookMeeting,
    warnings,
  };
}
