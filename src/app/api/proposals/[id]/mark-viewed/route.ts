/**
 * POST /api/proposals/[id]/mark-viewed — Manual action for tracking.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

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

    await db.$transaction([
      db.proposal.update({
        where: { id },
        data: { status: "viewed", viewedAt: now },
      }),
      db.proposalActivity.create({
        data: {
          proposalId: id,
          type: "viewed",
          message: "Marked viewed",
        },
      }),
    ]);

    return NextResponse.json({ status: "viewed", viewedAt: now.toISOString() });
  });
}
