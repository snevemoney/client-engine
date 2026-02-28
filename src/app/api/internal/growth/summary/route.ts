/**
 * Phase 6.3: GET /api/internal/growth/summary
 */
import { NextRequest } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { computeGrowthSummary } from "@/lib/growth/summary";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/growth/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache(
        `growth/summary:${userId}`,
        () => computeGrowthSummary(userId),
        15_000
      );
    } catch (err) {
      console.error("[growth/summary]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
