/**
 * POST /api/internal/scores/compute — Trigger score computation (auth required).
 * Phase 3.1: Score Engine. Phase 2: Uses score-service.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { compute } from "@/lib/services/score-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/scores/compute", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    let body: { entityType?: string; entityId?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const entityType = body?.entityType;
    const entityId = body?.entityId;

    if (!entityType || !entityId) {
      return jsonError("entityType and entityId required", 400);
    }
    if (typeof entityType !== "string" || typeof entityId !== "string") {
      return jsonError("entityType and entityId must be strings", 400);
    }

    try {
      const result = await compute(entityType, entityId);
      return NextResponse.json(result);
    } catch (err) {
      const msg = sanitizeErrorMessage(err);
      return jsonError(msg, 500);
    }
  });
}
