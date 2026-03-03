/**
 * GET /api/metrics/bottlenecks — Bottleneck flags (key, label, count, severity, href).
 * Aggregates from command-center style data.
 */
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { fetchBottlenecks } from "@/lib/metrics/bottlenecks";
import { withSummaryCache } from "@/lib/http/cached-handler";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/metrics/bottlenecks", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      return await withSummaryCache(
        "metrics/bottlenecks",
        async () => {
          const bottlenecks = await fetchBottlenecks();
          return { bottlenecks: bottlenecks ?? [] };
        },
        30_000
      );
    } catch (err) {
      console.error("[metrics/bottlenecks]", err);
      return jsonError("Failed to load bottlenecks", 500);
    }
  });
}
