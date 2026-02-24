/**
 * Performance instrumentation — consistent slow logging across the app.
 * Format: [SLOW] area=<api|page|db|action> name=<route/query> ms=<n> details=<optional>
 * Use for API routes, SSR pages, Prisma queries, and key actions.
 */

const SLOW_API_MS = 500;
const SLOW_PAGE_MS = 1000;
const SLOW_DB_MS = 300;
const SLOW_ACTION_MS = 2000;

export const PERF = {
  SLOW_API_MS,
  SLOW_PAGE_MS,
  SLOW_DB_MS,
  SLOW_ACTION_MS,
} as const;

/** Log a slow operation in a consistent format for grep/aggregation. */
export function logSlow(
  area: "api" | "page" | "db" | "action",
  name: string,
  ms: number,
  details?: string
): void {
  const msg = details
    ? `[SLOW] area=${area} name=${name} ms=${ms} details=${details}`
    : `[SLOW] area=${area} name=${name} ms=${ms}`;
  console.warn(msg);
}

/** Wrap an async fn with timing; logs if above threshold. */
export async function withTiming<T>(
  area: "api" | "page" | "db" | "action",
  name: string,
  fn: () => Promise<T>,
  thresholdMs?: number
): Promise<T> {
  const threshold = thresholdMs ?? (area === "db" ? SLOW_DB_MS : area === "api" ? SLOW_API_MS : SLOW_PAGE_MS);
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    if (ms > threshold) logSlow(area, name, ms);
    return result;
  } catch (err) {
    const ms = Date.now() - start;
    logSlow(area, name, ms, `error=${err instanceof Error ? err.message : "unknown"}`);
    throw err;
  }
}
