import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";

/** GET /api/intake-leads/summary — counts for scoreboard card. Unified: includes both IntakeLead and pipeline Lead. */
export async function GET() {
  return withRouteTiming("GET /api/intake-leads/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    return withSummaryCache("intake-leads/summary", async () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const [
        intakeNewThisWeek,
        qualified,
        sent,
        intakeWon,
        sentThisWeek,
        intakeWonThisWeek,
        proofCreatedThisWeek,
        pipelineNewThisWeek,
        pipelineWon,
        pipelineWonThisWeek,
      ] = await Promise.all([
        db.intakeLead.count({
          where: { status: "new", createdAt: { gte: weekStart } },
        }),
        db.intakeLead.count({ where: { status: "qualified" } }),
        db.intakeLead.count({ where: { status: "sent" } }),
        db.intakeLead.count({ where: { status: "won" } }),
        db.intakeLead.count({
          where: { status: "sent", proposalSentAt: { gte: weekStart } },
        }),
        db.intakeLead.count({
          where: { status: "won", updatedAt: { gte: weekStart } },
        }),
        db.proofRecord.count({ where: { createdAt: { gte: weekStart } } }),
        db.lead.count({
          where: {
            promotedFromIntake: null,
            createdAt: { gte: weekStart },
            status: { not: "REJECTED" },
          },
        }),
        db.lead.count({ where: { dealOutcome: "won" } }),
        db.lead.count({
          where: {
            dealOutcome: "won",
            updatedAt: { gte: weekStart },
          },
        }),
      ]);

      return {
        newThisWeek: intakeNewThisWeek + pipelineNewThisWeek,
        qualified,
        sent,
        won: intakeWon + pipelineWon,
        sentThisWeek,
        wonThisWeek: intakeWonThisWeek + pipelineWonThisWeek,
        proofCreatedThisWeek,
      };
    }, 15_000);
  });
}
