/**
 * Phase 2.6: Centralized safe date formatting.
 */

export function formatDateSafe(
  input: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (input == null) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleDateString(undefined, options ?? { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export function formatDateTimeSafe(
  input: Date | string | null | undefined
): string {
  if (input == null) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
