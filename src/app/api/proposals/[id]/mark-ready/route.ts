/**
 * POST /api/proposals/[id]/mark-ready — Set status to ready (readiness check).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeProposalReadiness } from "@/lib/proposals/readiness";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proposals/[id]/mark-ready", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const proposal = await db.proposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Proposal not found", 404);

    const readiness = computeProposalReadiness(proposal);
    if (!readiness.isReady) {
      return jsonError(
        `Not ready: ${readiness.reasons.join("; ")}`,
        400,
        "READINESS"
      );
    }

    await db.$transaction([
      db.proposal.update({
        where: { id },
        data: { status: "ready" },
      }),
      db.proposalActivity.create({
        data: {
          proposalId: id,
          type: "status_change",
          message: "Marked ready",
        },
      }),
    ]);

    return NextResponse.json({ status: "ready", message: "Proposal marked ready" });
  });
}
