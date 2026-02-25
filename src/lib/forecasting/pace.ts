/**
 * Phase 2.4: Pace-based forecasting helpers.
 * Deterministic, no ML. Null-safe, no NaN.
 */

export type PaceStatus = "ahead" | "on_track" | "behind";

export type ConfidenceLevel = "low" | "medium" | "high";

/**
 * Safe pace: count per day. Returns 0 if elapsedDays <= 0 or invalid.
 */
export function safePace(
  currentCount: number,
  elapsedDays: number,
  totalDays: number
): number {
  if (!Number.isFinite(currentCount)) return 0;
  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) return 0;
  if (!Number.isFinite(totalDays) || totalDays <= 0) return 0;
  const pace = currentCount / elapsedDays;
  return Number.isFinite(pace) && pace >= 0 ? pace : 0;
}

/**
 * Project count at end of period using linear pace.
 */
export function projectCount(
  currentCount: number,
  elapsedDays: number,
  totalDays: number
): number {
  const pace = safePace(currentCount, elapsedDays, totalDays);
  const projected = pace * totalDays;
  return Number.isFinite(projected) && projected >= 0 ? Math.round(projected) : 0;
}

/**
 * Project value at end of period using linear pace.
 */
export function projectValue(
  currentValue: number,
  elapsedDays: number,
  totalDays: number
): number {
  const pace = elapsedDays > 0 && Number.isFinite(currentValue) && Number.isFinite(elapsedDays) && Number.isFinite(totalDays) && totalDays > 0
    ? currentValue / elapsedDays
    : 0;
  const projected = pace * totalDays;
  return Number.isFinite(projected) && projected >= 0 ? Math.round(projected) : 0;
}

/**
 * Classify confidence based on data availability and volatility proxy.
 * More elapsed days + more data = higher confidence.
 */
export function classifyConfidence(
  elapsedDays: number,
  totalDays: number,
  dataPointsUsed?: number
): ConfidenceLevel {
  if (!Number.isFinite(elapsedDays) || !Number.isFinite(totalDays) || totalDays <= 0) return "low";
  const pctElapsed = elapsedDays / totalDays;
  const pts = dataPointsUsed ?? (elapsedDays > 0 ? 1 : 0);
  if (pctElapsed >= 0.5 && pts >= 3) return "high";
  if (pctElapsed >= 0.25 || pts >= 2) return "medium";
  return "low";
}

/**
 * Compare projected to target. Returns status.
 */
export function compareToTarget(
  projected: number,
  target: number | null | undefined
): { status: PaceStatus; delta?: number } {
  if (target == null || !Number.isFinite(target) || target <= 0) {
    return { status: "on_track" };
  }
  if (!Number.isFinite(projected)) return { status: "on_track" };
  const delta = projected - target;
  const pct = Math.abs(delta / target);
  if (delta >= 0 || pct < 0.05) return { status: "ahead", delta };
  if (pct < 0.15) return { status: "on_track", delta };
  return { status: "behind", delta };
}
