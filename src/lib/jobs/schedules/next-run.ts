/**
 * Phase 2.8.5: Compute next run time for recurring schedules.
 * Deterministic and unit-testable.
 */

import type { JobScheduleCadenceType } from "@prisma/client";

export type ScheduleInput = {
  cadenceType: JobScheduleCadenceType;
  intervalMinutes?: number | null;
  dayOfWeek?: number | null; // 0=Sun..6=Sat
  dayOfMonth?: number | null; // 1-31
  hour?: number | null; // 0-23
  minute?: number | null; // 0-59
};

/**
 * Clamp day of month to valid range for given month.
 */
function clampDayOfMonth(day: number, year: number, month: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(1, day), lastDay);
}

/**
 * Compute next run time from given date.
 * Returns null if schedule is invalid.
 */
export function computeNextRunAt(
  schedule: ScheduleInput,
  fromDate: Date
): Date | null {
  const h = Math.min(23, Math.max(0, schedule.hour ?? 0));
  const m = Math.min(59, Math.max(0, schedule.minute ?? 0));

  switch (schedule.cadenceType) {
    case "interval": {
      const mins = schedule.intervalMinutes ?? 60;
      if (mins < 1) return null;
      return new Date(fromDate.getTime() + mins * 60 * 1000);
    }

    case "daily": {
      const next = new Date(fromDate);
      next.setHours(h, m, 0, 0);
      if (next.getTime() <= fromDate.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }

    case "weekly": {
      const dow = Math.min(6, Math.max(0, schedule.dayOfWeek ?? 0));
      const next = new Date(fromDate);
      next.setHours(h, m, 0, 0);
      const currentDow = next.getDay();
      let daysToAdd = dow - currentDow;
      if (daysToAdd < 0) daysToAdd += 7;
      else if (daysToAdd === 0 && next.getTime() <= fromDate.getTime()) {
        daysToAdd = 7;
      }
      next.setDate(next.getDate() + daysToAdd);
      return next;
    }

    case "monthly": {
      const dom = schedule.dayOfMonth ?? 1;
      const next = new Date(fromDate);
      const year = next.getFullYear();
      const month = next.getMonth();
      const clamped = clampDayOfMonth(dom, year, month);
      next.setDate(clamped);
      next.setHours(h, m, 0, 0);
      if (next.getTime() <= fromDate.getTime()) {
        next.setMonth(next.getMonth() + 1);
        const nextMonth = next.getMonth();
        const nextYear = next.getFullYear();
        const nextClamped = clampDayOfMonth(dom, nextYear, nextMonth);
        next.setDate(nextClamped);
      }
      return next;
    }

    default:
      return null;
  }
}
