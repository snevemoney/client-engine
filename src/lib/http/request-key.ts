/**
 * Phase 2.6: Build stable request keys for dedupe/abort.
 */

export function buildRequestKey(
  method: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined | null> | URLSearchParams,
  bodyFingerprint?: string
): string {
  const parts: string[] = [method.toUpperCase(), path];
  if (query) {
    const params = query instanceof URLSearchParams
      ? Object.fromEntries(query.entries())
      : query;
    const sorted = Object.keys(params)
      .filter((k) => params[k] != null && params[k] !== "")
      .sort()
      .map((k) => `${k}=${String(params[k])}`);
    if (sorted.length > 0) parts.push(sorted.join("&"));
  }
  if (bodyFingerprint) parts.push(bodyFingerprint);
  return parts.join("|");
}

export function fingerprintBody(body: unknown): string {
  if (body == null) return "";
  try {
    return typeof body === "string" ? body : JSON.stringify(body);
  } catch {
    return "";
  }
}
