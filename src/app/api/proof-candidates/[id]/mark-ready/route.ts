import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProofCandidateStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeProofCandidateReadiness } from "@/lib/proof-candidates/readiness";

/** POST /api/proof-candidates/[id]/mark-ready */
export async function POST(
  _req: unknown,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proof-candidates/[id]/mark-ready", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const candidate = await db.proofCandidate.findUnique({ where: { id } });
    if (!candidate) return jsonError("Proof candidate not found", 404);

    if (candidate.status === ProofCandidateStatus.promoted) {
      return jsonError("Already promoted", 400, "VALIDATION");
    }
    if (candidate.status === ProofCandidateStatus.rejected) {
      return jsonError("Cannot mark rejected candidate ready", 400, "VALIDATION");
    }

    const { isReady, reasons } = computeProofCandidateReadiness(candidate);
    if (!isReady) {
      return jsonError(`Not ready: ${reasons.join("; ")}`, 400, "VALIDATION");
    }

    const updated = await db.proofCandidate.update({
      where: { id },
      data: {
        status: ProofCandidateStatus.ready,
        readyAt: candidate.readyAt ?? new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      candidate: {
        id: updated.id,
        status: updated.status,
        readyAt: updated.readyAt?.toISOString() ?? null,
      },
    });
  });
}
