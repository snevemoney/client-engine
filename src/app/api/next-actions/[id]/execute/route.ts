/**
 * POST /api/next-actions/[id]/execute — Run a delivery action.
 * Phase 4.2: Action buttons (mark_done, snooze_1d, recompute_score, etc.).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { runDeliveryAction, DELIVERY_ACTIONS } from "@/lib/next-actions/delivery-actions";

export const dynamic = "force-dynamic";

const VALID_ACTION_KEYS = Object.keys(DELIVERY_ACTIONS);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/next-actions/[id]/execute", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Missing action id", 400);

    const clientKey = getRequestClientKey(request, session.user?.id);
    const rl = rateLimitByKey({
      key: `rl:nba-execute:${clientKey}`,
      windowMs: 60_000,
      max: 20,
    });
    if (!rl.ok) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
      return jsonError("Rate limit exceeded. Try again in a minute.", 429, undefined, {
        headers: { "Retry-After": String(retryAfter), "Cache-Control": "private, no-store" },
        bodyExtra: { retryAfterSeconds: retryAfter },
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object") {
      return jsonError("Body must be an object", 400);
    }

    const actionKey = (body as Record<string, unknown>).actionKey;
    if (typeof actionKey !== "string" || !VALID_ACTION_KEYS.includes(actionKey)) {
      return jsonError(
        `actionKey must be one of: ${VALID_ACTION_KEYS.join(", ")}`,
        400
      );
    }

    const result = await runDeliveryAction({
      nextActionId: id,
      actionKey,
      actorUserId: session.user?.id ?? undefined,
    });

    if (!result.ok) {
      const status = result.errorCode === "not_found" ? 404 : result.errorCode === "unknown_action" ? 400 : 500;
      return jsonError(result.errorMessage ?? "Action failed", status, result.errorCode);
    }

    return NextResponse.json({
      ok: true,
      executionId: result.executionId,
    });
  });
}
