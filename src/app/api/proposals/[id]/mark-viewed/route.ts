/**
 * POST /api/proposals/[id]/mark-viewed — Manual action for tracking.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { logInteraction } from "@/lib/interactions/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/mark-viewed", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: { status: "viewed", viewedAt: now },
      });
      await tx.proposalActivity.create({
        data: {
          proposalId: id,
          type: "viewed",
          message: "Marked viewed",
        },
      });
      await logInteraction({
        category: "proposal_viewed",
        summary: "Proposal marked as viewed",
        proposalId: id,
        direction: "inbound",
        actorType: "user",
        actorId: session.user?.id,
        sourceModel: "ProposalActivity",
      }, tx);
    });

    return NextResponse.json({ status: "viewed", viewedAt: now.toISOString() });
  });
}
