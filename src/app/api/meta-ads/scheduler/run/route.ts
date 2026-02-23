/**
 * POST /api/meta-ads/scheduler/run
 * Triggers one scheduler cycle. Auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { runSchedulerCycle } from "@/lib/meta-ads/scheduler-run";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/meta-ads/scheduler/run", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId) return jsonError("META_AD_ACCOUNT_ID not set", 503);

    const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
    const trigger = (req.nextUrl.searchParams.get("trigger") ?? "manual") as "manual" | "scheduled";

    const result = await runSchedulerCycle(acc, trigger);

    return NextResponse.json({
      ok: result.status !== "failed",
      status: result.status,
      summary: result.summary,
      runLogId: result.runLogId,
    });
  });
}
