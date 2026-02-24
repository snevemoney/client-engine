import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProofCandidateStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  rejectedReason: z.string().max(500).optional().nullable(),
});

/** POST /api/proof-candidates/[id]/reject */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/proof-candidates/[id]/reject", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const candidate = await db.proofCandidate.findUnique({ where: { id } });
    if (!candidate) return jsonError("Proof candidate not found", 404);

    if (candidate.status === ProofCandidateStatus.promoted) {
      return jsonError("Cannot reject promoted candidate", 400, "VALIDATION");
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const reason = parsed.success && parsed.data.rejectedReason?.trim()
      ? parsed.data.rejectedReason.trim()
      : null;

    const updated = await db.proofCandidate.update({
      where: { id },
      data: {
        status: ProofCandidateStatus.rejected,
        rejectedReason: reason ?? candidate.rejectedReason,
      },
    });

    return NextResponse.json({
      ok: true,
      candidate: {
        id: updated.id,
        status: updated.status,
        rejectedReason: updated.rejectedReason ?? null,
      },
    });
  });
}
