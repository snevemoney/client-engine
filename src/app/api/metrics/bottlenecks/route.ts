/**
 * GET /api/metrics/bottlenecks — Bottleneck flags (key, label, count, severity, href).
 * Aggregates from command-center style data.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { fetchBottlenecks } from "@/lib/metrics/bottlenecks";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/metrics/bottlenecks", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const bottlenecks = await fetchBottlenecks();
      return NextResponse.json({
        bottlenecks: bottlenecks ?? [],
      });
    } catch (err) {
      console.error("[metrics/bottlenecks]", err);
      return jsonError("Failed to load bottlenecks", 500);
    }
  });
}
