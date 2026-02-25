/**
 * Phase 2.8.2: Shared JSON response helpers.
 * Stable content-type, consistent shapes.
 */

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export type ResponseInit = {
  status?: number;
  headers?: HeadersInit;
};

/**
 * Returns Response with JSON body. Status 200 by default.
 */
export function okJson(data: unknown, init?: ResponseInit): Response {
  const status = init?.status ?? 200;
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", JSON_CONTENT_TYPE);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Stable error shape: { error: true, message: "...", ...extra }
 */
export function errorJson(
  message: string,
  status = 400,
  extra?: Record<string, unknown>
): Response {
  const body: Record<string, unknown> = {
    error: true,
    message: message ?? "Error",
    ...extra,
  };
  const headers = new Headers({ "Content-Type": JSON_CONTENT_TYPE });
  if (extra?.retryAfterSeconds != null && typeof extra.retryAfterSeconds === "number") {
    headers.set("Retry-After", String(Math.ceil(extra.retryAfterSeconds)));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * No-store cache headers for dynamic data.
 */
export function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "private, no-store, max-age=0" };
}

/**
 * Short cache for GET summaries. Default 30s.
 */
export function shortCacheHeaders(seconds = 30): HeadersInit {
  return {
    "Cache-Control": `private, max-age=${Math.max(0, Math.floor(seconds))}, stale-while-revalidate=${Math.max(0, Math.floor(seconds))}`,
  };
}

/**
 * Merge headers from multiple sources. Later overwrites earlier.
 */
export function maybeMergeHeaders(...sources: (HeadersInit | null | undefined)[]): HeadersInit {
  const merged = new Headers();
  for (const src of sources) {
    if (!src) continue;
    const h = src instanceof Headers ? src : new Headers(src);
    h.forEach((value, key) => merged.set(key, value));
  }
  return merged;
}
