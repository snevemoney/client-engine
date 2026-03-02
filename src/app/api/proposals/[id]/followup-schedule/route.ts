/**
 * POST /api/proposals/[id]/followup-schedule — Set next follow-up date.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProposalActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { logInteraction } from "@/lib/interactions/service";
import { parseDate } from "@/lib/followup/dates";

const PostSchema = z.object({
  nextFollowUpAt: z.string().datetime(),
  nextAction: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/followup-schedule", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) return jsonError("Invalid body: nextFollowUpAt required", 400);

    const next = parseDate(parsed.data.nextFollowUpAt);
    if (!next) return jsonError("Invalid nextFollowUpAt date", 400);

    await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id },
        data: { nextFollowUpAt: next },
      });
      await tx.proposalActivity.create({
        data: {
          proposalId: id,
          type: "followup_scheduled" as ProposalActivityType,
          message: parsed.data.nextAction ?? `Follow-up scheduled for ${next.toISOString()}`,
          metaJson: { nextFollowUpAt: next.toISOString() },
        },
      });
      await logInteraction({
        category: "followup_scheduled",
        summary: `Follow-up scheduled for ${next.toISOString()}`,
        proposalId: id,
        direction: "internal",
        actorType: "user",
        actorId: session.user?.id,
        sourceModel: "ProposalActivity",
        metaJson: { nextFollowUpAt: next.toISOString() },
      }, tx);
    });

    return NextResponse.json({ ok: true, nextFollowUpAt: next.toISOString() });
  });
}
