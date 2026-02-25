/**
 * POST /api/notifications/run-escalations — Manual trigger (rate-limited).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { evaluateEscalationRules } from "@/lib/notifications/escalations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/notifications/run-escalations", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session?.user?.id);
    const rl = rateLimitByKey({
      key: `rl:notifications-run-escalations:${clientKey}`,
      windowMs: 60_000,
      max: 10,
    });
    if (!rl.ok) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: true, message: "Rate limit exceeded", retryAfterSeconds: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(50, Math.max(1, parseInt(String(body?.limit ?? 50), 10) || 50));

    const result = await evaluateEscalationRules({ limit });
    return NextResponse.json({
      ok: true,
      created: result.created,
      queued: result.queued,
    });
  });
}
