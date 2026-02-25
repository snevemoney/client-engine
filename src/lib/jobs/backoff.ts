/**
 * Phase 2.8.4: Deterministic retry backoff.
 * attempt 1 -> +30s, attempt 2 -> +2m, attempt 3 -> +10m
 */

const BACKOFF_SECONDS = [30, 120, 600]; // 30s, 2m, 10m

/**
 * Returns delay in milliseconds for given attempt (1-based).
 */
export function backoffMs(attempt: number): number {
  const idx = Math.min(Math.max(0, attempt - 1), BACKOFF_SECONDS.length - 1);
  return BACKOFF_SECONDS[idx]! * 1000;
}

/**
 * Returns runAfter date for retry.
 */
export function nextRunAfter(attempt: number): Date {
  const ms = backoffMs(attempt);
  return new Date(Date.now() + ms);
}
