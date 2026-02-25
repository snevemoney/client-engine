/**
 * POST /api/internal/scores/compute — Trigger score computation (auth required).
 * Phase 3.1: Score Engine.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { computeAndStoreScore } from "@/lib/scoring/compute-and-store";
import type { ScoreEntityType } from "@/lib/scoring/compute-and-store";

export const dynamic = "force-dynamic";

const VALID_ENTITY_TYPES: ScoreEntityType[] = ["review_stream", "command_center"];

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

    if (!VALID_ENTITY_TYPES.includes(entityType as ScoreEntityType)) {
      return jsonError(`entityType must be one of: ${VALID_ENTITY_TYPES.join(", ")}`, 400);
    }

    try {
      const result = await computeAndStoreScore(
        entityType as ScoreEntityType,
        String(entityId)
      );
      return NextResponse.json({
        snapshotId: result.snapshotId,
        score: result.score,
        band: result.band,
        delta: result.delta,
        eventsCreated: result.eventsCreated,
      });
    } catch (err) {
      const msg = sanitizeErrorMessage(err);
      return jsonError(msg, 500);
    }
  });
}
