/**
 * GET /api/ops/scoreboard — Current week scoreboard data for /dashboard/scoreboard
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/strategyWeek";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/ops/scoreboard", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const weekStart = getWeekStart();
    const week = await db.strategyWeek.findUnique({
      where: { weekStart },
      include: {
        review: true,
        priorities: true,
      },
    });

    if (!week) {
      return NextResponse.json(null);
    }

    const prioritiesDone = week.priorities.filter((p) => p.status === "done").length;

    const integrations = await db.integrationConnection.findMany({
      where: { isEnabled: true },
      select: { provider: true, mode: true, status: true },
    });
    const integrationReady = integrations.filter(
      (i) => (i.mode === "live" || i.mode === "mock") && i.status === "connected"
    ).length;
    const integrationTotal = integrations.length;

    const byMode = { off: 0, mock: 0, manual: 0, live: 0 };
    for (const i of integrations) {
      const mode = ["off", "mock", "manual", "live"].includes(i.mode) ? i.mode : "off";
      byMode[mode] += 1;
    }

    const alerts: string[] = [];
    if (week.weeklyTargetValue == null && !week.declaredCommitment?.trim())
      alerts.push("No weekly target set");
    if (!week.keyMetric?.trim()) alerts.push("No key metric set");
    if (week.priorities.length === 0) alerts.push("No priorities");
    if (!week.review?.completedAt) alerts.push("Review not completed");
    const allOff = integrations.every((i) => i.mode === "off");
    if (integrations.length > 0 && allOff) alerts.push("All integrations OFF");

    return NextResponse.json({
      weekStart: week.weekStart.toISOString(),
      phase: week.phase,
      activeCampaignName: week.activeCampaignName,
      weeklyTargetValue: week.weeklyTargetValue ? Number(week.weeklyTargetValue) : null,
      weeklyTargetUnit: week.weeklyTargetUnit,
      declaredCommitment: week.declaredCommitment,
      keyMetric: week.keyMetric,
      keyMetricTarget: week.keyMetricTarget,
      fuelStatement: week.fuelStatement,
      integrationByMode: byMode,
      alerts,
      review: week.review
        ? {
            campaignShipped: week.review.campaignShipped,
            systemImproved: week.review.systemImproved,
            salesActionsDone: week.review.salesActionsDone,
            proofCaptured: week.review.proofCaptured,
            score: week.review.score,
            biggestBottleneck: week.review.biggestBottleneck,
            nextAutomation: week.review.nextAutomation,
            completedAt: week.review.completedAt?.toISOString() ?? null,
          }
        : null,
      prioritiesDone,
      prioritiesTotal: week.priorities.length,
      integrationReady,
      integrationTotal,
    });
  });
}
