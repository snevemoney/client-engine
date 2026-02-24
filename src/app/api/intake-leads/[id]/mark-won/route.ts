import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { LeadActivityType } from "@prisma/client";

const PostSchema = z.object({
  outcomeReason: z.string().max(2000).optional().nullable(),
});

/** POST /api/intake-leads/[id]/mark-won — Sets status won, optionally syncs pipeline, creates proof draft */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/mark-won", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({
      where: { id },
      include: { promotedLead: true },
    });

    if (!intake) return jsonError("Lead not found", 404);

    if (intake.status === "won") {
      return NextResponse.json({
        ok: true,
        status: "won",
        message: "Already marked won",
      });
    }

    const raw = await req.json().catch(() => null);
    const body = PostSchema.safeParse(raw).data ?? {};
    const outcomeReason = body.outcomeReason?.trim() ?? null;

    const proofTitle = [intake.title, intake.company].filter(Boolean).join(" — ") || intake.title;
    const proofSnippet = [intake.summary, intake.scoreReason]
      .filter(Boolean)
      .map((s) => (s && s.length > 200 ? s.slice(0, 200) + "…" : s))
      .join(". ") || "Won opportunity. Add proof snippet.";

    const proofRecord = await db.proofRecord.create({
      data: {
        sourceType: "intake_lead",
        sourceId: id,
        intakeLeadId: id,
        title: proofTitle,
        company: intake.company ?? undefined,
        outcome: "won",
        proofSnippet: proofSnippet.trim() || null,
        beforeState: null,
        afterState: null,
        metricValue: null,
        metricLabel: null,
      },
    });

    await db.$transaction(async (tx) => {
      await tx.intakeLead.update({
        where: { id },
        data: { status: "won", outcomeReason: outcomeReason ?? undefined },
      });
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.status_change,
          content: "Marked won",
          metadataJson: {
            outcomeReason: outcomeReason ?? null,
            proofRecordId: proofRecord.id,
          },
        },
      });
      if (intake.promotedLeadId && intake.promotedLead) {
        await tx.lead.update({
          where: { id: intake.promotedLeadId },
          data: { dealOutcome: "won" },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      status: "won",
      proofRecordId: proofRecord.id,
      proofRecord: {
        id: proofRecord.id,
        title: proofRecord.title,
        outcome: proofRecord.outcome,
        proofSnippet: proofRecord.proofSnippet,
      },
    });
  });
}
