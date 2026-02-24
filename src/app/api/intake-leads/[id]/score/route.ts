import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoreIntakeLead } from "@/lib/intake-lead/score";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { LeadActivityType } from "@prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/score", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const lead = await db.intakeLead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);

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

    return NextResponse.json({
      score: result.score,
      scoreReason: result.scoreReason,
    });
  });
}
