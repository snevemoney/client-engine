/**
 * Phase 2.1: Proposal follow-up utilities.
 * Null-safe, guards invalid dates.
 */

import {
  isValidDate,
  getStartOfDay,
  getEndOfDay,
  parseDate,
  computeSnoozeDate,
  type SnoozeType,
} from "@/lib/followup/dates";

export type ProposalFollowupBucket = "overdue" | "today" | "upcoming" | "none";

export type ProposalLike = {
  status?: string | null;
  sentAt?: Date | string | null;
  respondedAt?: Date | string | null;
  acceptedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  nextFollowUpAt?: Date | string | null;
  lastContactedAt?: Date | string | null;
  staleAfterDays?: number | null;
};

const DEFAULT_STALE_DAYS = 7;

/**
 * Whether a proposal has a follow-up due (nextFollowUpAt in the past or today).
 */
export function isProposalFollowupDue(proposal: ProposalLike): boolean {
  const next = parseDate(proposal.nextFollowUpAt);
  if (!next || !isValidDate(next)) return false;
  const now = new Date();
  const endToday = getEndOfDay(now);
  return next <= endToday;
}

/**
 * Classify proposal follow-up bucket from nextFollowUpAt.
 */
export function classifyProposalFollowupBucket(
  nextFollowUpAt: Date | string | null | undefined,
  now: Date = new Date(),
  upcomingDays = 7
): ProposalFollowupBucket {
  const dueAt = parseDate(nextFollowUpAt);
  if (!dueAt || !isValidDate(dueAt)) return "none";

  const startToday = getStartOfDay(now);
  const endToday = getEndOfDay(now);
  const endUpcoming = new Date(now);
  endUpcoming.setDate(endUpcoming.getDate() + upcomingDays);
  endUpcoming.setHours(23, 59, 59, 999);

  if (dueAt < startToday) return "overdue";
  if (dueAt >= startToday && dueAt <= endToday) return "today";
  if (dueAt > endToday && dueAt <= endUpcoming) return "upcoming";
  return "none";
}

/**
 * Compute whether a proposal is stale: sent, no accepted/rejected, no response after N days.
 */
export function computeProposalStaleState(proposal: ProposalLike): {
  isStale: boolean;
  staleDays: number;
} {
  const sentAt = parseDate(proposal.sentAt);
  const respondedAt = parseDate(proposal.respondedAt);
  const acceptedAt = parseDate(proposal.acceptedAt);
  const rejectedAt = parseDate(proposal.rejectedAt);

  if (!sentAt || !isValidDate(sentAt)) return { isStale: false, staleDays: 0 };
  if (acceptedAt || rejectedAt) return { isStale: false, staleDays: 0 };
  if (respondedAt && isValidDate(respondedAt)) return { isStale: false, staleDays: 0 };

  const staleDays = proposal.staleAfterDays ?? DEFAULT_STALE_DAYS;
  const cutoff = new Date(sentAt);
  cutoff.setDate(cutoff.getDate() + staleDays);
  const now = new Date();
  const isStale = now > cutoff;

  return { isStale, staleDays };
}

/**
 * Compute next follow-up date from snooze preset.
 */
export function computeNextProposalFollowupDate(
  input: { preset: SnoozeType; customDate?: string | null },
  fromDate: Date = new Date()
): Date | null {
  return computeSnoozeDate(input.preset, fromDate, input.customDate);
}
