/**
 * Phase 1.3: Shared date utilities for follow-up queue.
 * Null-safe, guards invalid dates.
 */

export function isValidDate(d: unknown): d is Date {
  if (!(d instanceof Date)) return false;
  return !Number.isNaN(d.getTime());
}

export function getStartOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function getEndOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function parseDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isValidDate(input) ? input : null;
  if (typeof input === "string") {
    const d = new Date(input.trim());
    return isValidDate(d) ? d : null;
  }
  return null;
}

export type SnoozeType = "2d" | "5d" | "next_monday" | "custom";

/**
 * Compute new due date from snooze type.
 * next_monday: if today is Monday, use next Monday; else next occurring Monday
 */
export function computeSnoozeDate(
  type: SnoozeType,
  fromDate: Date,
  customDue?: string | null
): Date | null {
  if (!isValidDate(fromDate)) return null;

  const from = new Date(fromDate);

  switch (type) {
    case "2d": {
      const out = new Date(from);
      out.setDate(out.getDate() + 2);
      return out;
    }
    case "5d": {
      const out = new Date(from);
      out.setDate(out.getDate() + 5);
      return out;
    }
    case "next_monday": {
      const out = new Date(from);
      const day = out.getDay();
      const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
      out.setDate(out.getDate() + daysUntilMonday);
      return out;
    }
    case "custom":
      return customDue?.trim() ? parseDate(customDue.trim()) : null;
    default:
      return null;
  }
}

export type Bucket = "overdue" | "today" | "upcoming";

/**
 * Classify a due date into bucket given now and days window for upcoming.
 */
export function classifyFollowUpBucket(
  dueAt: Date | null,
  now: Date,
  upcomingDays = 7
): Bucket | null {
  if (!dueAt || !isValidDate(dueAt)) return null;

  const startToday = getStartOfDay(now);
  const endToday = getEndOfDay(now);
  const endUpcoming = new Date(now);
  endUpcoming.setDate(endUpcoming.getDate() + upcomingDays);
  endUpcoming.setHours(23, 59, 59, 999);

  if (dueAt < startToday) return "overdue";
  if (dueAt >= startToday && dueAt <= endToday) return "today";
  if (dueAt > endToday && dueAt <= endUpcoming) return "upcoming";
  return null;
}
