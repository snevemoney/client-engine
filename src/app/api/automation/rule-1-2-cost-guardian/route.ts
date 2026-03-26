import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * RULE 1.2: Cost Guardian Alert
 * 
 * Monitors API costs and alerts operator when spending exceeds threshold.
 * 
 * Trigger: Daily cost aggregation (via cron)
 * Threshold: $100/day
 * 
 * Actions on threshold breach:
 *   1. Log alert to #alerts (Telegram topic 13)
 *   2. Invoke Ledger agent for cost breakdown
 *   3. Suggest cost-saving measures
 * 
 * Success metric: Alerts sent <5 minutes after threshold breach
 */

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get today's cost from Ledger
    const todayCost = await getTodayCost();

    const THRESHOLD = 100;
    const breached = todayCost > THRESHOLD;

    if (breached) {
      // Alert operator
      const alert = await sendAlert({
        level: "warning",
        title: "Cost Guardian: Daily threshold exceeded",
        message: `Daily API spend: $${todayCost.toFixed(2)} (threshold: $${THRESHOLD})`,
        breakdown: await getCostBreakdown(),
        suggestions: [
          "Reduce API token logging verbosity",
          "Enable caching for repeated queries",
          "Use Haiku for routine tasks instead of Sonnet",
          "Review batch_process efficiency",
        ],
      });

      return NextResponse.json({
        success: true,
        alert: alert,
        cost: todayCost,
        threshold: THRESHOLD,
        breached: true,
      });
    }

    return NextResponse.json({
      success: true,
      cost: todayCost,
      threshold: THRESHOLD,
      breached: false,
      remaining: (THRESHOLD - todayCost).toFixed(2),
    });
  } catch (error) {
    console.error("[Rule 1.2] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get today's API cost
 */
async function getTodayCost(): Promise<number> {
  // TODO: Query cost tracking database
  // For now, return mock data
  return 85.5;
}

/**
 * Helper: Get cost breakdown by service
 */
async function getCostBreakdown(): Promise<Record<string, number>> {
  return {
    anthropic: 45.2,
    kling_api: 20.1,
    fal_ai: 15.3,
    replicate: 5.0,
  };
}

/**
 * Helper: Send alert to operator
 */
async function sendAlert(alert: any): Promise<any> {
  // TODO: Send to Telegram topic 13 (#alerts)
  // For now, return mock success
  return {
    success: true,
    sent_at: new Date().toISOString(),
    channel: "telegram",
    topic: 13,
  };
}
