/**
 * GET /api/risk/summary — Counts by severity, snoozed, lastRunAt.
 * Cached 15s. Phase 2: Uses risk-service.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { getSummary } from "@/lib/services/risk-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/risk/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache("risk/summary", async () => {
        const summary = await getSummary();
        return {
          openBySeverity: summary.openBySeverity,
          snoozedCount: summary.snoozedCount,
          lastRunAt: summary.lastRunAt,
        };
      }, 15_000);
    } catch (err) {
      console.error("[risk/summary]", err);
      return jsonError("Failed to load risk summary", 500);
    }
  });
}
