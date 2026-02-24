/**
 * POST /api/proposals/[id]/mark-sent — Set status sent, sync to intake/pipeline.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/mark-sent", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: { status: "sent", sentAt: now, respondedAt: now },
      });
      await tx.proposalActivity.create({
        data: {
          proposalId: id,
          type: "sent",
          message: "Marked sent",
        },
      });

      if (proposal.intakeLeadId) {
        const intake = await tx.intakeLead.findUnique({
          where: { id: proposal.intakeLeadId },
        });
        if (intake && intake.status !== IntakeLeadStatus.won && intake.status !== IntakeLeadStatus.lost) {
          await tx.intakeLead.update({
            where: { id: proposal.intakeLeadId },
            data: {
              status: IntakeLeadStatus.sent,
              proposalSentAt: now,
            },
          });
        }
      }

      if (proposal.pipelineLeadId) {
        const lead = await tx.lead.findUnique({
          where: { id: proposal.pipelineLeadId },
        });
        if (lead && !lead.proposalSentAt) {
          await tx.lead.update({
            where: { id: proposal.pipelineLeadId },
            data: { proposalSentAt: now },
          });
        }
      }
    });

    return NextResponse.json({ status: "sent", sentAt: now.toISOString() });
  });
}
