/**
 * Phase 2.8.2: Simple in-memory rate limiter.
 * Fail-open: on error, returns { ok: true } so route still works.
 */

type WindowEntry = {
  count: number;
  resetAt: number;
};

const windows = new Map<string, WindowEntry>();

/**
 * Rate limit by key. Returns { ok, remaining, resetAt }.
 * Fail-open: on any error, returns ok: true.
 */
export function rateLimitByKey(opts: {
  key: string;
  windowMs: number;
  max: number;
  now?: number;
}): { ok: boolean; remaining: number; resetAt: number } {
  try {
    const now = opts.now ?? Date.now();
    const entry = windows.get(opts.key);
    if (!entry) {
      const resetAt = now + opts.windowMs;
      windows.set(opts.key, { count: 1, resetAt });
      return { ok: true, remaining: opts.max - 1, resetAt };
    }
    if (now >= entry.resetAt) {
      const resetAt = now + opts.windowMs;
      windows.set(opts.key, { count: 1, resetAt });
      return { ok: true, remaining: opts.max - 1, resetAt };
    }
    entry.count++;
    const remaining = Math.max(0, opts.max - entry.count);
    const ok = entry.count <= opts.max;
    return { ok, remaining, resetAt: entry.resetAt };
  } catch {
    return { ok: true, remaining: opts.max, resetAt: Date.now() + opts.windowMs };
  }
}

/**
 * Get client key for rate limiting. Prefer userId, else IP from headers, else "anonymous".
 */
export function getRequestClientKey(request: Request, userId?: string | null): string {
  if (userId?.trim()) return `user:${userId.trim()}`;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return `ip:${ip}`;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return `ip:${realIp.trim()}`;
  return "anonymous";
}
