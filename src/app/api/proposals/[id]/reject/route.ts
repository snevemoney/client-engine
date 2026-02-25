/**
 * POST /api/proposals/[id]/reject — Set rejected.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IntakeLeadStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  reason: z.string().max(1000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/reject", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const reason = parsed.success && parsed.data.reason ? parsed.data.reason : null;

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: { status: "rejected", rejectedAt: now, respondedAt: now, responseStatus: "rejected" },
      });
      await tx.proposalActivity.create({
        data: {
          proposalId: id,
          type: "rejected",
          message: reason ?? "Proposal rejected",
          metaJson: reason ? { reason } : undefined,
        },
      });

      if (proposal.intakeLeadId) {
        const intake = await tx.intakeLead.findUnique({
          where: { id: proposal.intakeLeadId },
        });
        if (intake && intake.status !== IntakeLeadStatus.won) {
          await tx.intakeLead.update({
            where: { id: proposal.intakeLeadId },
            data: { status: IntakeLeadStatus.lost, outcomeReason: reason ?? undefined },
          });
        }
      }
    });

    return NextResponse.json({ status: "rejected", rejectedAt: now.toISOString() });
  });
}
