/**
 * Phase 2.8.2: Caching wrapper for GET summary endpoints.
 * Fail-open: cache errors do not block the route.
 */

import { NextResponse } from "next/server";
import { getOrSet } from "@/lib/cache/memory-cache";
import { shortCacheHeaders } from "@/lib/http/response";

const DEFAULT_TTL_MS = 15_000; // 15s for dashboards

/**
 * Wrap a summary handler with in-memory TTL cache.
 * Cache key should be unique per route + relevant query params.
 */
export async function withSummaryCache<T>(
  cacheKey: string,
  handler: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<NextResponse> {
  const data = await getOrSet(cacheKey, ttlMs, handler);
  const headers = shortCacheHeaders(Math.floor(ttlMs / 1000));
  return NextResponse.json(data, { headers });
}

/**
 * Build cache key from route and optional params.
 */
export function summaryCacheKey(route: string, params?: Record<string, string | null>): string {
  if (!params || Object.keys(params).length === 0) return `summary:${route}`;
  const sorted = Object.entries(params)
    .filter(([, v]) => v != null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return sorted ? `summary:${route}:${sorted}` : `summary:${route}`;
}
