/**
 * POST /api/proposals/[id]/followup-snooze — Snooze follow-up with preset.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProposalActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeNextProposalFollowupDate } from "@/lib/proposals/followup";

const PostSchema = z.object({
  preset: z.enum(["2d", "5d", "next_monday", "custom"]),
  customDate: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/followup-snooze", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) return jsonError("Invalid body: preset required", 400);

    const fromDate = proposal.nextFollowUpAt ?? new Date();
    const next = computeNextProposalFollowupDate(
      { preset: parsed.data.preset, customDate: parsed.data.customDate },
      fromDate
    );
    if (!next) return jsonError("Invalid snooze preset or custom date", 400);

    await db.$transaction([
      db.proposal.update({
        where: { id },
        data: { nextFollowUpAt: next },
      }),
      db.proposalActivity.create({
        data: {
          proposalId: id,
          type: "followup_snoozed" as ProposalActivityType,
          message: `Snoozed to ${next.toISOString()}`,
          metaJson: { preset: parsed.data.preset, nextFollowUpAt: next.toISOString() },
        },
      }),
    ]);

    return NextResponse.json({ ok: true, nextFollowUpAt: next.toISOString() });
  });
}
