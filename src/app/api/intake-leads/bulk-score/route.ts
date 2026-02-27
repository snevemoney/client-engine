import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreIntakeLead } from "@/lib/intake-lead/score";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { IntakeLeadStatus, LeadActivityType } from "@prisma/client";

/**
 * POST /api/intake-leads/bulk-score — Score all unscored intake leads.
 */
export async function POST() {
  return withRouteTiming("POST /api/intake-leads/bulk-score", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const unscored = await db.intakeLead.findMany({
      where: {
        status: { notIn: [IntakeLeadStatus.won, IntakeLeadStatus.lost, IntakeLeadStatus.archived] },
        score: null,
      },
      select: { id: true },
    });

    const results: { id: string; score: number }[] = [];

    for (const { id } of unscored) {
      const lead = await db.intakeLead.findUnique({ where: { id } });
      if (!lead) continue;

      const result = scoreIntakeLead({
        source: lead.source,
        title: lead.title,
        company: lead.company,
        summary: lead.summary,
        budgetMin: lead.budgetMin,
        budgetMax: lead.budgetMax,
        urgency: lead.urgency,
      });

      await db.$transaction([
        db.intakeLead.update({
          where: { id },
          data: { score: result.score, scoreReason: result.scoreReason },
        }),
        db.leadActivity.create({
          data: {
            intakeLeadId: id,
            type: LeadActivityType.score,
            content: `Scored: ${result.score}. ${result.scoreReason}`,
            metadataJson: { score: result.score, scoreReason: result.scoreReason },
          },
        }),
      ]);

      results.push({ id, score: result.score });
    }

    return NextResponse.json({
      ok: true,
      scored: results.length,
      results,
    });
  });
}
