import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { LeadActivityType } from "@prisma/client";

/** POST /api/intake-leads/[id]/mark-sent */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/intake-leads/[id]/mark-sent", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const intake = await db.intakeLead.findUnique({
      where: { id },
      include: { promotedLead: true },
    });

    if (!intake) return jsonError("Lead not found", 404);

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.intakeLead.update({
        where: { id },
        data: { status: "sent", proposalSentAt: now },
      });
      await tx.leadActivity.create({
        data: {
          intakeLeadId: id,
          type: LeadActivityType.sent,
          content: "Proposal marked as sent",
          metadataJson: { proposalSentAt: now.toISOString() },
        },
      });
      if (intake.promotedLeadId && intake.promotedLead) {
        await tx.lead.update({
          where: { id: intake.promotedLeadId },
          data: { proposalSentAt: now },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      status: "sent",
      proposalSentAt: now.toISOString(),
    });
  });
}
