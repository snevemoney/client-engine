/**
 * Phase 2.3: Date range helpers for metrics APIs.
 * Supports: this_week | last_4_weeks | last_12_weeks | all
 */

import { getWeekStart } from "@/lib/ops/weekStart";

export type MetricsRange = "this_week" | "last_4_weeks" | "last_12_weeks" | "all";

export function getRangeBounds(
  range: MetricsRange,
  now: Date = new Date()
): { start: Date | null; end: Date | null } {
  const weekStart = getWeekStart(now);
  const endOfWeek = new Date(weekStart);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  switch (range) {
    case "this_week":
      return { start: weekStart, end: endOfWeek };
    case "last_4_weeks": {
      const start = new Date(weekStart);
      start.setDate(start.getDate() - 4 * 7);
      return { start, end: endOfWeek };
    }
    case "last_12_weeks": {
      const start = new Date(weekStart);
      start.setDate(start.getDate() - 12 * 7);
      return { start, end: endOfWeek };
    }
    case "all":
      return { start: null, end: null };
    default:
      return { start: weekStart, end: endOfWeek };
  }
}

/** Build Prisma date filter from range bounds. */
export function dateFilter(
  field: string,
  bounds: { start: Date | null; end: Date | null }
): Record<string, unknown> | null {
  if (!bounds.start && !bounds.end) return null;
  const filter: Record<string, unknown> = {};
  if (bounds.start) filter.gte = bounds.start;
  if (bounds.end) filter.lte = bounds.end;
  return Object.keys(filter).length > 0 ? filter : null;
}
