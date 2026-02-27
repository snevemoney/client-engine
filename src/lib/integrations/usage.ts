/**
 * API usage tracking for integration provider calls.
 * Every provider client should call trackApiUsage() after each external request.
 * Cost estimates use known per-request pricing where available.
 */

import { db } from "@/lib/db";

export type ApiUsageEntry = {
  provider: string;
  action: string;
  endpoint?: string;
  requestCount?: number;
  tokensUsed?: number;
  responseBytes?: number;
  latencyMs?: number;
  estimatedCostUsd?: number;
  status?: "success" | "error" | "rate_limited";
  errorMessage?: string;
  meta?: Record<string, unknown>;
};

const COST_PER_REQUEST: Record<string, number> = {
  github: 0,
  rss: 0,
  calendly: 0,
  calcom: 0,
  hubspot: 0,
  pipedrive: 0,
  stripe: 0,
  upwork: 0,
  linkedin: 0,
  meta: 0.001,
  ga4: 0,
  search_console: 0,
  youtube: 0.0001,
  instagram: 0,
  x: 0.0001,
  "google-ads": 0.001,
  google_business_profile: 0,
  loom: 0,
  pinecone: 0,
  firecrawl: 0.001,
  posthog: 0,
};

export function estimateCost(provider: string, requestCount: number): number {
  const perReq = COST_PER_REQUEST[provider] ?? 0;
  return perReq * requestCount;
}

/**
 * Log a single API usage entry. Fire-and-forget by default.
 */
export async function trackApiUsage(entry: ApiUsageEntry): Promise<void> {
  const cost =
    entry.estimatedCostUsd ?? estimateCost(entry.provider, entry.requestCount ?? 1);
  try {
    await db.apiUsageLog.create({
      data: {
        provider: entry.provider,
        action: entry.action,
        endpoint: entry.endpoint ?? null,
        requestCount: entry.requestCount ?? 1,
        tokensUsed: entry.tokensUsed ?? null,
        responseBytes: entry.responseBytes ?? null,
        latencyMs: entry.latencyMs ?? null,
        estimatedCostUsd: cost,
        status: entry.status ?? "success",
        errorMessage: entry.errorMessage ?? null,
        meta: entry.meta ?? undefined,
      },
    });
  } catch (err) {
    console.error("[api-usage] Failed to log usage:", err);
  }
}

/**
 * Wrap a fetch call with automatic usage tracking.
 * Returns the Response and logs usage in the background.
 */
export async function trackedFetch(
  provider: string,
  action: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const start = Date.now();
  let status: "success" | "error" | "rate_limited" = "success";
  let errorMessage: string | undefined;

  try {
    const res = await fetch(url, init);
    const latencyMs = Date.now() - start;

    if (res.status === 429) status = "rate_limited";
    else if (!res.ok) {
      status = "error";
      errorMessage = `HTTP ${res.status}`;
    }

    trackApiUsage({
      provider,
      action,
      endpoint: `${init?.method ?? "GET"} ${new URL(url).pathname}`,
      latencyMs,
      status,
      errorMessage,
    });

    return res;
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    trackApiUsage({
      provider,
      action,
      endpoint: `${init?.method ?? "GET"} ${url}`,
      latencyMs,
      status: "error",
      errorMessage: msg,
    });
    throw err;
  }
}

export type UsageSummary = {
  provider: string;
  totalRequests: number;
  totalCostUsd: number;
  errorCount: number;
  rateLimitCount: number;
};

export type UsagePeriod = "24h" | "7d" | "30d" | "all";

/**
 * Get aggregated usage stats per provider for a given period.
 */
export async function getUsageSummary(period: UsagePeriod = "30d"): Promise<UsageSummary[]> {
  const since = periodToDate(period);

  const rows = await db.apiUsageLog.groupBy({
    by: ["provider"],
    where: since ? { createdAt: { gte: since } } : undefined,
    _sum: {
      requestCount: true,
      estimatedCostUsd: true,
    },
    _count: true,
    orderBy: { _sum: { requestCount: "desc" } },
  });

  const errorCounts = await db.apiUsageLog.groupBy({
    by: ["provider", "status"],
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      status: { in: ["error", "rate_limited"] },
    },
    _count: true,
  });

  const errorMap = new Map<string, { errors: number; rateLimits: number }>();
  for (const row of errorCounts) {
    const existing = errorMap.get(row.provider) ?? { errors: 0, rateLimits: 0 };
    if (row.status === "error") existing.errors += row._count;
    if (row.status === "rate_limited") existing.rateLimits += row._count;
    errorMap.set(row.provider, existing);
  }

  return rows.map((r) => ({
    provider: r.provider,
    totalRequests: r._sum.requestCount ?? 0,
    totalCostUsd: r._sum.estimatedCostUsd ?? 0,
    errorCount: errorMap.get(r.provider)?.errors ?? 0,
    rateLimitCount: errorMap.get(r.provider)?.rateLimits ?? 0,
  }));
}

/**
 * Get recent usage log entries for a specific provider or all.
 */
export async function getUsageLogs(opts: {
  provider?: string;
  period?: UsagePeriod;
  limit?: number;
}) {
  const since = periodToDate(opts.period ?? "7d");
  return db.apiUsageLog.findMany({
    where: {
      ...(opts.provider ? { provider: opts.provider } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
}

function periodToDate(period: UsagePeriod): Date | null {
  if (period === "all") return null;
  const now = new Date();
  switch (period) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}
