/**
 * GET /api/internal/scores/history — Score timeline (auth required).
 * Phase 3.1: Score Engine. Phase 2: Uses score-service.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { getHistory } from "@/lib/services/score-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/scores/history", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(request.url);
      const entityType = searchParams.get("entityType");
      const entityId = searchParams.get("entityId");
      const range = searchParams.get("range") ?? "7d";

      if (!entityType || !entityId) {
        return jsonError("entityType and entityId required", 400);
      }

      const history = await getHistory(entityType, entityId, range);
      return NextResponse.json(history);
    } catch (err) {
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
