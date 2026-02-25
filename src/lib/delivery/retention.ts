/**
 * Phase 2.2: Retention follow-up utilities.
 * Null-safe, manual-first.
 */

import { isValidDate, getStartOfDay, getEndOfDay, parseDate } from "@/lib/followup/dates";

export type RetentionBucket = "overdue" | "today" | "upcoming" | "none";

export type RetentionSnoozePreset = "7d" | "14d" | "30d" | "next_month" | "custom";

export type DeliveryProjectLike = {
  status?: string | null;
  completedAt?: Date | string | null;
  handoffCompletedAt?: Date | string | null;
  testimonialRequestedAt?: Date | string | null;
  testimonialReceivedAt?: Date | string | null;
  testimonialStatus?: string | null;
  referralRequestedAt?: Date | string | null;
  referralReceivedAt?: Date | string | null;
  referralStatus?: string | null;
  reviewRequestedAt?: Date | string | null;
  reviewReceivedAt?: Date | string | null;
  retentionNextFollowUpAt?: Date | string | null;
  retentionLastContactedAt?: Date | string | null;
};

const DEFAULT_STALE_DAYS = 14;

/**
 * Classify retention follow-up bucket from nextFollowUpAt.
 */
export function classifyRetentionBucket(
  nextFollowUpAt: Date | string | null | undefined,
  now: Date = new Date(),
  upcomingDays = 7
): RetentionBucket {
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
 * Compute whether a project is stale post-delivery:
 * completed/handoff done but no testimonial/referral/review activity after N days.
 */
export function computeRetentionStale(
  project: DeliveryProjectLike,
  staleDays = DEFAULT_STALE_DAYS
): { isStale: boolean; staleDays: number } {
  const status = (project.status ?? "").toString().toLowerCase();
  if (status !== "completed" && status !== "archived") {
    return { isStale: false, staleDays };
  }

  const handoffCompletedAt = parseDate(project.handoffCompletedAt);
  if (!handoffCompletedAt || !isValidDate(handoffCompletedAt)) {
    return { isStale: false, staleDays };
  }

  const hasActivity =
    project.testimonialRequestedAt ||
    project.testimonialReceivedAt ||
    project.referralRequestedAt ||
    project.referralReceivedAt ||
    project.reviewRequestedAt ||
    project.reviewReceivedAt ||
    project.retentionLastContactedAt;

  if (hasActivity) {
    const lastActivity = [
      parseDate(project.testimonialRequestedAt),
      parseDate(project.testimonialReceivedAt),
      parseDate(project.referralRequestedAt),
      parseDate(project.referralReceivedAt),
      parseDate(project.reviewRequestedAt),
      parseDate(project.reviewReceivedAt),
      parseDate(project.retentionLastContactedAt),
    ]
      .filter((d): d is Date => d != null && isValidDate(d))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (lastActivity) {
      const cutoff = new Date(lastActivity);
      cutoff.setDate(cutoff.getDate() + staleDays);
      const now = new Date();
      return { isStale: now > cutoff, staleDays };
    }
  }

  const cutoff = new Date(handoffCompletedAt);
  cutoff.setDate(cutoff.getDate() + staleDays);
  const now = new Date();
  return { isStale: now > cutoff, staleDays };
}

/**
 * Compute next follow-up date from preset.
 */
export function computeRetentionNextDate(
  input: { preset: RetentionSnoozePreset; customDate?: string | null },
  fromDate: Date = new Date()
): Date | null {
  if (!isValidDate(fromDate)) return null;

  const from = new Date(fromDate);

  switch (input.preset) {
    case "7d": {
      const out = new Date(from);
      out.setDate(out.getDate() + 7);
      return out;
    }
    case "14d": {
      const out = new Date(from);
      out.setDate(out.getDate() + 14);
      return out;
    }
    case "30d": {
      const out = new Date(from);
      out.setDate(out.getDate() + 30);
      return out;
    }
    case "next_month": {
      const out = new Date(from);
      out.setMonth(out.getMonth() + 1);
      return out;
    }
    case "custom":
      return input.customDate?.trim() ? parseDate(input.customDate.trim()) : null;
    default:
      return null;
  }
}
