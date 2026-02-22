export function parseLimit(
  value: string | null,
  fallback = 20,
  max = 100
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.floor(n);
  if (int < 1) return fallback;
  return Math.min(int, max);
}
