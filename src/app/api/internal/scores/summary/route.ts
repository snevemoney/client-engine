/**
 * GET /api/internal/scores/summary — Aggregated score data for dashboard UI (auth required).
 * Phase 3.2: Scoreboard UI. Phase 2: Uses score-service.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { getSummary } from "@/lib/services/score-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/scores/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(request.url);
      const entityType = searchParams.get("entityType") ?? "command_center";
      const entityId = searchParams.get("entityId") ?? "command_center";

      const summary = await getSummary(entityType, entityId);
      return NextResponse.json(summary);
    } catch (err) {
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
