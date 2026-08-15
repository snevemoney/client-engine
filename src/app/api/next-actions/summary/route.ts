/**
 * GET /api/next-actions/summary — Top 5 queued + counts by priority.
 * Phase 4.1: Supports entityType, entityId scope. Cached 15s. Phase 2: Uses nba-service.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { getSummary } from "@/lib/services/nba-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/next-actions/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const entityType = request.nextUrl.searchParams.get("entityType");
    const entityId = request.nextUrl.searchParams.get("entityId");

    try {
      return await withSummaryCache(
        `next-actions/summary:${entityType ?? "command_center"}:${entityId ?? "command_center"}`,
        async () => getSummary(entityType, entityId),
        15_000
      );
    } catch (err) {
      console.error("[next-actions/summary]", err);
      return jsonError("Failed to load next actions summary", 500);
    }
  });
}
