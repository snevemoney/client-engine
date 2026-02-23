/**
 * Week start normalization (Monday 00:00, ISO week).
 * Pure helper — no DB dependency.
 */

/** Get Monday 00:00 for the week containing d */
export function getWeekStart(d: Date = new Date()): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - (day === 0 ? 6 : day - 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
