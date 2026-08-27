/**
 * Fail-closed HMAC helpers for inbound webhooks.
 * Missing secret, missing signature, or length mismatch → false.
 */
import crypto from "crypto";

export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hmacSha256Hex(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * GitHub webhook: header `x-hub-signature-256` is `sha256=<hex>`.
 * Returns false when the secret is unset or the header does not match.
 */
export function verifyGitHubWebhookSignature(opts: {
  secret: string | undefined;
  signatureHeader: string | null | undefined;
  rawBody: string;
}): boolean {
  const secret = opts.secret?.trim();
  if (!secret) return false;
  const header = opts.signatureHeader?.trim() ?? "";
  if (!header) return false;
  const expected = `sha256=${hmacSha256Hex(secret, opts.rawBody)}`;
  return timingSafeEqualString(expected, header);
}

/**
 * Generic HMAC-SHA256 of the raw body. Accepts raw hex or `sha256=<hex>`.
 * Returns false when the secret is unset or the header does not match.
 */
export function verifyHmacSha256Signature(opts: {
  secret: string | undefined;
  signatureHeader: string | null | undefined;
  rawBody: string;
}): boolean {
  const secret = opts.secret?.trim();
  if (!secret) return false;
  let provided = opts.signatureHeader?.trim() ?? "";
  if (!provided) return false;
  if (provided.toLowerCase().startsWith("sha256=")) {
    provided = provided.slice(7);
  }
  const expected = hmacSha256Hex(secret, opts.rawBody);
  return timingSafeEqualString(expected, provided);
}

/** First non-empty header from the list. */
export function firstHeader(
  headers: { get: (name: string) => string | null },
  names: string[]
): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value?.trim()) return value;
  }
  return null;
}
