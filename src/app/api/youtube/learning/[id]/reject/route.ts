import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TRANSCRIPT_STATUS } from "@/lib/youtube/types";

/**
 * POST /api/youtube/learning/:id/reject
 * Mark a proposal as rejected with reviewer notes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: { reviewerNotes?: string; knowledgeOnly?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine
  }

  const proposal = await db.learningProposal.findUnique({ where: { id } });
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const newStatus = body.knowledgeOnly
    ? TRANSCRIPT_STATUS.KNOWLEDGE_ONLY
    : TRANSCRIPT_STATUS.REJECTED;

  const updated = await db.learningProposal.update({
    where: { id },
    data: {
      status: newStatus,
      reviewerNotes: body.reviewerNotes ?? proposal.reviewerNotes,
    },
  });

  return NextResponse.json({
    ok: true,
    proposal: {
      id: updated.id,
      status: updated.status,
      reviewerNotes: updated.reviewerNotes,
    },
  });
}
