/**
 * Phase 5.3: POST /api/internal/copilot/sessions/[id]/close — Close session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { closeSession, getSession } from "@/lib/copilot/session-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/internal/copilot/sessions/[id]/close", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const clientKey = getRequestClientKey(request, session.user?.id);
    const rl = rateLimitByKey({ key: `rl:copilot-sessions:${clientKey}`, windowMs: 60_000, max: 30 });
    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return jsonError("Rate limit exceeded", 429, undefined, {
        headers: { "Retry-After": String(retryAfter) },
      });
    }

    const { id } = await params;
    const existing = await getSession(id);
    if (!existing) return jsonError("Session not found", 404);

    const closed = await closeSession(id);
    return NextResponse.json(closed);
  });
}
