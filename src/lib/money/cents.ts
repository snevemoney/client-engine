/** Convert a dollar amount (UI / API) to integer cents for storage. */
export function dollarsToCents(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars < 0) return 0;
  return Math.round(dollars * 100);
}

/** Convert stored integer cents to dollars for API / UI responses. */
export function centsToDollars(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return cents / 100;
}
