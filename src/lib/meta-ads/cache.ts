/**
 * In-memory cache for Meta Ads dashboard responses.
 * TTL 10 min by default. Key: accountId:range.
 */

import { META_ADS_CACHE_TTL_SEC } from "./constants";

type CacheEntry<T> = { data: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

function cacheKey(accountId: string, range: string): string {
  return `meta-ads:${accountId}:${range}`;
}

export function getCached<T>(accountId: string, range: string): T | null {
  const key = cacheKey(accountId, range);
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached<T>(accountId: string, range: string, data: T): void {
  const key = cacheKey(accountId, range);
  cache.set(key, {
    data,
    expiresAt: Date.now() + META_ADS_CACHE_TTL_SEC * 1000,
  });
}
