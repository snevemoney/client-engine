import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateDraft } from "@/lib/intake-lead/draft";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { LeadActivityType } from "@prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/draft", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const lead = await db.intakeLead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);

    const draft = generateDraft({
      title: lead.title,
      company: lead.company,
      summary: lead.summary,
      urgency: lead.urgency,
      score: lead.score,
    });

    await db.leadActivity.create({
      data: {
        intakeLeadId: id,
        type: LeadActivityType.draft,
        content: draft.full,
        metadataJson: {
          opener: draft.opener,
          problemFraming: draft.problemFraming,
          proposedNextStep: draft.proposedNextStep,
          cta: draft.cta,
        },
      },
    });

    return NextResponse.json({
      opener: draft.opener,
      problemFraming: draft.problemFraming,
      proposedNextStep: draft.proposedNextStep,
      cta: draft.cta,
      full: draft.full,
    });
  });
}
