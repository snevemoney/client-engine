/**
 * GET /api/intake-leads/action-summary — Pipeline hygiene counts for command center.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getStartOfDay } from "@/lib/followup/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/intake-leads/action-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const startToday = getStartOfDay(now);

    const [
      unscoredCount,
      readyToPromoteCount,
      promotedMissingNextActionCount,
      sentFollowupOverdueCount,
      wonMissingProofCount,
    ] = await Promise.all([
      db.intakeLead.count({
        where: {
          status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost, IntakeLeadStatus.archived] },
          score: null,
        },
      }),
      db.intakeLead.count({
        where: {
          status: { in: ["qualified", "proposal_drafted"] },
          promotedLeadId: null,
          title: { not: "" },
          summary: { not: "" },
        },
      }),
      db.intakeLead.count({
        where: {
          promotedLeadId: { not: null },
          nextActionDueAt: null,
          followUpDueAt: null,
          status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost] },
        },
      }),
      db.intakeLead.count({
        where: {
          status: "sent",
          OR: [
            { followUpDueAt: { lt: startToday } },
            { nextActionDueAt: { lt: startToday } },
          ],
        },
      }),
      db.intakeLead.count({
        where: {
          status: "won",
          proofCandidates: { none: {} },
          proofRecords: { none: {} },
        },
      }),
    ]);

    return NextResponse.json({
      unscoredCount: unscoredCount ?? 0,
      readyToPromoteCount: readyToPromoteCount ?? 0,
      promotedMissingNextActionCount: promotedMissingNextActionCount ?? 0,
      sentFollowupOverdueCount: sentFollowupOverdueCount ?? 0,
      wonMissingProofCount: wonMissingProofCount ?? 0,
    });
  });
}
