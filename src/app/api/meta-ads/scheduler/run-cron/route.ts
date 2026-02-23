/**
 * POST /api/meta-ads/scheduler/run-cron
 * Cron-triggered scheduler run. Protected by x-cron-key header.
 * No session auth. Intended for VPS cron/PM2/worker.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { runSchedulerCycle } from "@/lib/meta-ads/scheduler-run";
import { sendOperatorAlert } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/meta-ads/scheduler/run-cron", async () => {
    const cronKey = process.env.META_ADS_SCHEDULER_CRON_KEY?.trim();
    if (!cronKey) return jsonError("Scheduler cron not configured", 503);

    const providedKey = req.headers.get("x-cron-key")?.trim();
    if (providedKey !== cronKey) return jsonError("Invalid cron key", 401);

    const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
    if (!accountId) return jsonError("META_AD_ACCOUNT_ID not set", 503);

    const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
    const result = await runSchedulerCycle(acc, "scheduled");

    if (result.status === "failed" && result.summary.error) {
      try {
        sendOperatorAlert({
          subject: "[Meta Ads Scheduler] Cron run failed",
          body: `Account: ${acc}\nStatus: failed\nError: ${result.summary.error}\nTrigger: scheduled`,
          webhookContext: { event: "meta_ads_scheduler_cron_failed", message: result.summary.error },
        });
      } catch {
        // Don't block
      }
    }

    return NextResponse.json({
      ok: result.status !== "failed",
      status: result.status,
      summary: result.summary,
      runLogId: result.runLogId,
    });
  });
}
