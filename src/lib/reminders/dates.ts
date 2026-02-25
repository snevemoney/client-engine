/**
 * Phase 2.5: Reminder date helpers.
 * Null-safe, no NaN.
 */

import { getStartOfDay } from "@/lib/followup/dates";

export type ReminderBucket = "overdue" | "today" | "upcoming" | "snoozed" | "unscheduled";

export function isValidDate(d: unknown): d is Date {
  if (!(d instanceof Date)) return false;
  return !Number.isNaN(d.getTime());
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

export function isReminderDue(
  dueAt: Date | string | null | undefined,
  snoozedUntil: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  const snooze = parseDate(snoozedUntil);
  if (snooze && snooze.getTime() > now.getTime()) return false;
  const due = parseDate(dueAt);
  if (!due) return false;
  return due.getTime() <= now.getTime();
}

export function classifyReminderBucket(
  dueAt: Date | string | null | undefined,
  snoozedUntil: Date | string | null | undefined,
  status: string | null | undefined,
  now: Date = new Date()
): ReminderBucket {
  const s = (status ?? "").toLowerCase();
  if (s === "snoozed") {
    const snooze = parseDate(snoozedUntil);
    if (snooze && snooze.getTime() > now.getTime()) return "snoozed";
  }
  if (s === "done" || s === "dismissed") return "unscheduled";

  const due = parseDate(dueAt);
  if (!due || Number.isNaN(due.getTime())) return "unscheduled";

  const startToday = getStartOfDay(now);
  const endToday = new Date(startToday);
  endToday.setHours(23, 59, 59, 999);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  if (due.getTime() < startToday.getTime()) return "overdue";
  if (due.getTime() >= startToday.getTime() && due.getTime() <= endToday.getTime()) return "today";
  return "upcoming";
}

export type SnoozePreset = "2h" | "tomorrow" | "3d" | "7d" | "next_monday" | "custom";

export function computeSnoozeUntil(
  preset: SnoozePreset,
  fromDate: Date = new Date(),
  customDate?: string | null
): Date | null {
  if (!isValidDate(fromDate)) return null;
  const from = new Date(fromDate);

  switch (preset) {
    case "2h": {
      const out = new Date(from);
      out.setTime(out.getTime() + 2 * 60 * 60 * 1000);
      return out;
    }
    case "tomorrow": {
      const out = new Date(from);
      out.setDate(out.getDate() + 1);
      out.setHours(9, 0, 0, 0);
      return out;
    }
    case "3d": {
      const out = new Date(from);
      out.setDate(out.getDate() + 3);
      return out;
    }
    case "7d": {
      const out = new Date(from);
      out.setDate(out.getDate() + 7);
      return out;
    }
    case "next_monday": {
      const out = new Date(from);
      const day = out.getDay();
      const daysToMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
      out.setDate(out.getDate() + daysToMonday);
      out.setHours(9, 0, 0, 0);
      return out;
    }
    case "custom": {
      const d = parseDate(customDate);
      return d && d.getTime() > from.getTime() ? d : null;
    }
    default:
      return null;
  }
}
