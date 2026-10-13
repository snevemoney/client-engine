/**
 * Builder API auth. Fail closed: missing BUILDER_API_KEY rejects every request.
 * No "dev-key" fallback.
 */
import crypto from "crypto";
import type { NextRequest } from "next/server";

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireBuilderApiKey(req: NextRequest): boolean {
  const expected = process.env.BUILDER_API_KEY?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  return timingSafeEqualString(auth, `Bearer ${expected}`);
}
