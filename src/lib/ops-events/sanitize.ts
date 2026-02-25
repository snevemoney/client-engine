/**
 * Phase 2.7: Sanitization helpers for ops events and audit.
 * Redacts secrets, truncates long strings, strips undefined.
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
  "webhookUrl",
  "webhook_url",
]);

const MAX_STRING_LENGTH = 500;

function isRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  return Array.from(REDACT_KEYS).some((r) => lower.includes(r.toLowerCase()));
}

/**
 * Sanitize meta object: strip undefined, redact secrets, truncate long strings.
 */
export function sanitizeMeta(input: unknown): Record<string, unknown> | null {
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
      out[k] = v.length > MAX_STRING_LENGTH ? v.slice(0, MAX_STRING_LENGTH) + "…" : v;
      continue;
    }
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    if (typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date)) {
      const nested = sanitizeMeta(v);
      if (nested && Object.keys(nested).length > 0) out[k] = nested;
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v.slice(0, 20).map((item) =>
        typeof item === "object" && item !== null ? sanitizeMeta(item) : item
      );
      continue;
    }
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_.-]+/gi;
const WEBHOOK_URL_PATTERN = /https?:\/\/[^\s'"]*hooks?[^\s'"]*/gi;
const API_KEY_PATTERN = /(?:sk_live_|sk_test_|api[_-]?key['":\s]*)[A-Za-z0-9_-]+/gi;

function redactSecretsFromString(s: string): string {
  return s
    .replace(BEARER_PATTERN, "[redacted]")
    .replace(WEBHOOK_URL_PATTERN, "[url redacted]")
    .replace(API_KEY_PATTERN, "[redacted]");
}

/**
 * Safe short error message for logging and API responses (no stack traces, no secrets).
 */
export function sanitizeErrorMessage(err: unknown): string {
  if (err == null) return "Unknown error";
  let msg: string;
  if (typeof err === "string") msg = err;
  else if (err instanceof Error) msg = err.message ?? "Error";
  else msg = String(err);
  return redactSecretsFromString(msg).slice(0, MAX_STRING_LENGTH);
}

/**
 * Deterministic short fingerprint from parts.
 */
export function safeFingerprint(parts: Array<string | number | null | undefined>): string {
  const str = parts
    .filter((p) => p != null && p !== "")
    .map((p) => String(p))
    .join("|");
  if (!str) return "";
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `fp_${Math.abs(h).toString(36)}`;
}
