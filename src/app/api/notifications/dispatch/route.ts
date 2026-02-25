/**
 * POST /api/notifications/dispatch — Manual trigger (rate-limited).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { dispatchPendingDeliveries } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/notifications/dispatch", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session?.user?.id);
    const rl = rateLimitByKey({
      key: `rl:notifications-dispatch:${clientKey}`,
      windowMs: 60_000,
      max: 20,
    });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(50, Math.max(1, parseInt(String(body?.limit ?? 20), 10) || 20));

    const result = await dispatchPendingDeliveries(limit);
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    });
  });
}
