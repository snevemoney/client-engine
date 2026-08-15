/**
 * GET /api/voice/metrics — Voice follow-up metrics.
 */
import { NextResponse } from "next/server";
import { requireAuth, jsonError, withRouteTiming } from "@/lib/api-utils";
import { getEligibleProposals } from "@/lib/voice";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/voice/metrics", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const [eligible, logs] = await Promise.all([
      getEligibleProposals(1000).then((p) => p.length),
      db.voiceCallLog.findMany({
        select: { outcome: true },
      }),
    ]);

    const totalCalls = logs.length;
    const successCount = logs.filter(
      (l) => l.outcome === "booked_callback" || l.outcome === "requested_manual_followup"
    ).length;
    const successRate = totalCalls > 0 ? successCount / totalCalls : 0;
    const hasApiKey = !!(process.env.VAPI_API_KEY || process.env.RETELL_API_KEY);
    const degraded = !hasApiKey;

    return NextResponse.json({
      eligibleCount: eligible,
      totalCalls,
      successRate: Math.round(successRate * 100) / 100,
      ...(degraded ? { degraded: true } : {}),
    });
  });
}
