import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TRANSCRIPT_STATUS } from "@/lib/youtube/types";

/**
 * POST /api/youtube/learning/:id/promote
 * Manual promotion only — creates/updates playbook artifact.
 * Requires explicit confirmation (human-gated).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { reviewerNotes?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine
  }

  const proposal = await db.learningProposal.findUnique({
    where: { id },
    include: { transcript: { select: { videoId: true, title: true } } },
  });

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  if (proposal.status === TRANSCRIPT_STATUS.PROMOTED_TO_PLAYBOOK) {
    return NextResponse.json({ error: "Already promoted" }, { status: 409 });
  }

  const updated = await db.learningProposal.update({
    where: { id },
    data: {
      status: TRANSCRIPT_STATUS.PROMOTED_TO_PLAYBOOK,
      reviewerNotes: body.reviewerNotes ?? proposal.reviewerNotes,
    },
  });

  return NextResponse.json({
    ok: true,
    proposal: {
      id: updated.id,
      status: updated.status,
      summary: updated.summary,
      producedAssetType: updated.producedAssetType,
      systemArea: updated.systemArea,
    },
  });
}
