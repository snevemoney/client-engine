const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * In-memory rate limiter. Use key = e.g. `${userId}:${routeName}`.
 * For production at scale, consider Redis-backed limiter.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (b.count >= limit) {
    return { ok: false, remaining: 0, resetAt: b.resetAt };
  }

  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}
