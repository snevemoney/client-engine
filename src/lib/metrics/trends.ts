/**
 * Phase 2.3: Trend helpers for weekly metrics.
 */

import { getWeekStart } from "@/lib/ops/weekStart";

export type TrendPoint = {
  weekStart: string;
  weekLabel: string;
  value: number;
  count?: number;
};

export type TrendDelta = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  direction: "up" | "down" | "flat";
};

/**
 * Get week start for a date.
 */
export function getCurrentWeekStart(d: Date = new Date()): Date {
  return getWeekStart(d);
}

/**
 * Get week start for N weeks ago.
 */
export function getWeekStartOffset(d: Date, weeksAgo: number): Date {
  const w = getWeekStart(d);
  const out = new Date(w);
  out.setDate(out.getDate() - weeksAgo * 7);
  return out;
}

/**
 * Build list of week start dates for last N weeks.
 */
export function buildWeekBuckets(now: Date, weeks: number): Date[] {
  const buckets: Date[] = [];
  for (let i = 0; i < weeks; i++) {
    buckets.push(getWeekStartOffset(now, i));
  }
  return buckets.reverse();
}

/**
 * Normalize a date to week start (Monday 00:00).
 */
export function normalizeToWeekStart(d: Date): Date {
  return getWeekStart(d);
}

/**
 * Compare current vs previous week.
 */
export function compareWeeks(current: number, previous: number): TrendDelta {
  const delta = current - previous;
  const deltaPercent =
    previous !== 0 && Number.isFinite(previous) ? (delta / previous) * 100 : (current > 0 ? 100 : 0);
  let direction: "up" | "down" | "flat" = "flat";
  if (delta > 0) direction = "up";
  else if (delta < 0) direction = "down";

  return {
    current,
    previous,
    delta: Number.isFinite(delta) ? delta : 0,
    deltaPercent: Number.isFinite(deltaPercent) ? deltaPercent : 0,
    direction,
  };
}
