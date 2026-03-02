/**
 * POST /api/proposals/[id]/followup-log-call — Log call outreach.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProposalActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { logInteraction } from "@/lib/interactions/service";

const PostSchema = z.object({
  note: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/followup-log-call", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const note = parsed.success ? parsed.data.note : undefined;

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: {
          lastContactedAt: now,
          followUpCount: { increment: 1 },
        },
      });
      await tx.proposalActivity.create({
        data: {
          proposalId: id,
          type: "followup_call" as ProposalActivityType,
          message: note ?? "Call logged",
        },
      });
      await logInteraction({
        category: "call_completed",
        summary: note ?? "Call logged",
        proposalId: id,
        channel: "call",
        direction: "outbound",
        actorType: "user",
        actorId: session.user?.id,
        sourceModel: "ProposalActivity",
      }, tx);
    });

    return NextResponse.json({ ok: true });
  });
}
