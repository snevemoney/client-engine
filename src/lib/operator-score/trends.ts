/**
 * Phase 2.4: Operator score trend helpers.
 */

import { getWeekStart } from "@/lib/ops/weekStart";

export type PeriodType = "weekly" | "monthly";

/** Get month start (first day of month, 00:00) */
export function getMonthStart(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Get week start for N weeks ago */
export function getWeekStartOffset(d: Date, weeksAgo: number): Date {
  const w = getWeekStart(d);
  const out = new Date(w);
  out.setDate(out.getDate() - weeksAgo * 7);
  return out;
}

/** Get month start for N months ago */
export function getMonthStartOffset(d: Date, monthsAgo: number): Date {
  const m = getMonthStart(d);
  const out = new Date(m);
  out.setMonth(out.getMonth() - monthsAgo);
  return out;
}

export type ScoreTrendDelta = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  direction: "up" | "down" | "flat";
};

export function compareScoreToPrevious(current: number, previous: number): ScoreTrendDelta {
  const delta = current - previous;
  const deltaPercent =
    previous !== 0 && Number.isFinite(previous) ? (delta / previous) * 100 : (current > 0 ? 100 : 0);
  let direction: "up" | "down" | "flat" = "flat";
  if (delta > 0) direction = "up";
  else if (delta < 0) direction = "down";
  return {
    current: Number.isFinite(current) ? current : 0,
    previous: Number.isFinite(previous) ? previous : 0,
    delta: Number.isFinite(delta) ? delta : 0,
    deltaPercent: Number.isFinite(deltaPercent) ? deltaPercent : 0,
    direction,
  };
}

export function gradeToColor(grade: string): string {
  switch (grade.toUpperCase()) {
    case "A":
      return "text-emerald-400";
    case "B":
      return "text-green-400";
    case "C":
      return "text-yellow-400";
    case "D":
      return "text-orange-400";
    case "F":
      return "text-red-400";
    default:
      return "text-neutral-400";
  }
}

export function formatScoreLabel(score: number): string {
  if (!Number.isFinite(score)) return "—";
  return String(Math.round(score));
}
