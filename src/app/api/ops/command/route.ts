/**
 * GET /api/ops/command — aggregate data for Command Center (queue, constraint, money scorecard, last run, etc.)
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { buildBrief } from "@/lib/orchestrator/brief";
import { getQueueSummary } from "@/lib/ops/queueSummary";
import { getConstraintSnapshot } from "@/lib/ops/constraint";
import { getMoneyScorecard } from "@/lib/ops/moneyScorecard";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/ops/command", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const [brief, queue, constraint, moneyScorecard, lastRunReport] = await Promise.all([
      buildBrief(),
      getQueueSummary(),
      getConstraintSnapshot(),
      getMoneyScorecard(),
      db.artifact.findFirst({
        where: {
          lead: { source: "system", title: "Research Engine Runs" },
          title: "WORKDAY_RUN_REPORT",
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, content: true },
      }),
    ]);

    const recentErrors = await db.pipelineRun.findMany({
      where: { success: false },
      orderBy: { lastErrorAt: "desc" },
      take: 5,
      include: { lead: { select: { title: true } } },
    });

    return NextResponse.json({
      brief: {
        qualifiedLeads: brief.qualifiedLeads.length,
        readyProposals: brief.readyProposals.length,
        nextActions: brief.nextActions,
        wins: brief.wins.length,
        risks: brief.risks,
        engineOn: brief.engineOn,
      },
      queue,
      constraint,
      moneyScorecard,
      lastWorkdayRunAt: lastRunReport?.createdAt?.toISOString() ?? null,
      lastWorkdayRunPreview: lastRunReport?.content?.slice(0, 400) ?? null,
      recentErrors: recentErrors.map((r) => ({
        leadId: r.leadId,
        leadTitle: r.lead.title,
        code: r.lastErrorCode,
        at: r.lastErrorAt?.toISOString(),
      })),
    });
  });
}
