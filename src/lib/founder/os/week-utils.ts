/**
 * Phase 6.2: Week/quarter date utilities for Founder OS.
 */

/** Get Monday 00:00 UTC for a given date. */
export function getWeekStart(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  copy.setUTCDate(copy.getUTCDate() + diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/** Get Sunday 23:59:59.999 for the week. */
export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** Parse YYYY-MM-DD to Date (UTC midnight). */
export function parseWeekStart(s: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const [, y, m, d] = match;
  const month = parseInt(m!, 10) - 1;
  if (month < 0 || month > 11) return null;
  const date = new Date(Date.UTC(parseInt(y!, 10), month, parseInt(d!, 10)));
  if (date.getUTCMonth() !== month) return null;
  return getWeekStart(date);
}

/** Format Date as YYYY-MM-DD. */
export function formatWeekStart(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Get current quarter (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec). */
export function getCurrentQuarter(d: Date): { startsAt: Date; endsAt: Date; title: string } {
  const year = d.getFullYear();
  const month = d.getMonth();
  const q = Math.floor(month / 3) + 1;
  const startMonth = (q - 1) * 3;
  const startsAt = new Date(Date.UTC(year, startMonth, 1));
  const endsAt = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
  return {
    startsAt,
    endsAt,
    title: `${year} Q${q}`,
  };
}
