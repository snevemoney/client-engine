import { NextRequest, NextResponse } from "next/server";
import { rateLimitByKey, getRequestClientKey } from "@/lib/http/rate-limit";

export const runtime = "nodejs";

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-DNS-Prefetch-Control": "off",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-src 'self' http://localhost:3001 https://*.vercel.app; frame-ancestors 'none';",
};

export function middleware(request: NextRequest) {
  const clientKey = getRequestClientKey(request);

  const rl = rateLimitByKey({
    key: `rl:global:${clientKey}`,
    windowMs: 60_000,
    max: 100,
  });

  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));

    // Track burst for security notifications (lazy import to avoid circular deps)
    try {
      const { trackSecurityEvent } = require("@/lib/security/tracker");
      const burst = trackSecurityEvent({
        key: `burst:ratelimit:${clientKey}`,
        windowMs: 300_000,
        threshold: 10,
      });
      if (burst.shouldNotify) {
        const { emitSecurityEvent } = require("@/lib/security/events");
        void emitSecurityEvent({
          type: "security.rate_limit_burst" as const,
          clientKey,
          detail: `${burst.count} rate-limited requests in 5 minutes from ${clientKey}`,
          meta: { count: burst.count, path: request.nextUrl.pathname },
        });
      }
    } catch {
      // Best-effort: security tracking should never block the response
    }

    return new NextResponse(
      JSON.stringify({ error: "Too many requests", retryAfterSeconds: retryAfter }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          ...SECURITY_HEADERS,
        },
      },
    );
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
