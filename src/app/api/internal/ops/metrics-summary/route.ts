/**
 * GET /api/internal/ops/metrics-summary — Observability metrics (auth required).
 * Phase 2.9: Notifications, deliveries, escalations, jobs.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { getMetricsSummary } from "@/lib/notifications/metrics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/ops/metrics-summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") ?? "24h") as "24h" | "7d";
    if (period !== "24h" && period !== "7d") {
      return jsonError("Invalid period. Use 24h or 7d", 400);
    }

    try {
      const summary = await getMetricsSummary(period);
      return NextResponse.json(summary);
    } catch (err) {
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
