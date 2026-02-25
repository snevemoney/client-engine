/**
 * Phase 2.8.6: Notification payload sanitization.
 * Redacts secrets, tokens, webhook URLs with credentials.
 */

const REDACT_KEYS = new Set([
  "token",
  "secret",
  "password",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "configJson",
  "config_json",
  "authorization",
  "Authorization",
  "webhookUrl",
  "webhook_url",
  "url",
]);

const MAX_STRING_LENGTH = 500;

function isRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  return Array.from(REDACT_KEYS).some((r) => lower.includes(r.toLowerCase()));
}

/**
 * Sanitize for notification storage. Never store secrets.
 */
export function sanitizeNotificationMeta(input: unknown): Record<string, unknown> | null {
  if (input == null) return null;
  if (typeof input !== "object") return { value: String(input).slice(0, MAX_STRING_LENGTH) };
  const obj = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (isRedactKey(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string") {
      if (k === "url" || k.toLowerCase().includes("url")) {
        out[k] = "[url]";
        continue;
      }
      out[k] = v.length > MAX_STRING_LENGTH ? v.slice(0, MAX_STRING_LENGTH) + "…" : v;
      continue;
    }
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    if (typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date)) {
      const nested = sanitizeNotificationMeta(v);
      if (nested && Object.keys(nested).length > 0) out[k] = nested;
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v.slice(0, 20).map((item) =>
        typeof item === "object" && item !== null ? sanitizeNotificationMeta(item) : item
      );
      continue;
    }
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}
