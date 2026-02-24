import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { LeadActivityType } from "@prisma/client";

const PostSchema = z.object({
  outcomeReason: z.string().max(2000).optional().nullable(),
});

/** POST /api/intake-leads/[id]/mark-lost */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/mark-lost", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({
      where: { id },
      include: { promotedLead: true },
    });

    if (!intake) return jsonError("Lead not found", 404);

    if (intake.status === "lost") {
      return NextResponse.json({
        ok: true,
        status: "lost",
        message: "Already marked lost",
      });
    }

    const raw = await req.json().catch(() => null);
    const body = PostSchema.safeParse(raw).data ?? {};
    const outcomeReason = body.outcomeReason?.trim() ?? null;

    await db.$transaction(async (tx) => {
      await tx.intakeLead.update({
        where: { id },
        data: { status: "lost", outcomeReason: outcomeReason ?? undefined },
      });
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.status_change,
          content: outcomeReason ? `Marked lost: ${outcomeReason}` : "Marked lost",
          metadataJson: { outcomeReason: outcomeReason ?? null },
        },
      });
      if (intake.promotedLeadId && intake.promotedLead) {
        await tx.lead.update({
          where: { id: intake.promotedLeadId },
          data: { dealOutcome: "lost" },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      status: "lost",
    });
  });
}
