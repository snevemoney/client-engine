/**
 * GET /api/proof-candidates/summary — Weekly metrics for scoreboard/reviews.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { getWeekStart } from "@/lib/ops/weekStart";
import { ProofCandidateStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/proof-candidates/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const now = new Date();
    const startOfWeek = getWeekStart(now);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const [
      createdThisWeek,
      readyThisWeek,
      promotedThisWeek,
      pendingDrafts,
      pendingReady,
    ] = await Promise.all([
      db.proofCandidate.count({
        where: { createdAt: { gte: startOfWeek, lte: endOfWeek } },
      }),
      db.proofCandidate.count({
        where: {
          status: ProofCandidateStatus.ready,
          readyAt: { gte: startOfWeek, lte: endOfWeek },
        },
      }),
      db.proofCandidate.count({
        where: {
          status: ProofCandidateStatus.promoted,
          promotedAt: { gte: startOfWeek, lte: endOfWeek },
        },
      }),
      db.proofCandidate.count({
        where: { status: ProofCandidateStatus.draft },
      }),
      db.proofCandidate.count({
        where: { status: ProofCandidateStatus.ready },
      }),
    ]);

    return NextResponse.json({
      createdThisWeek: createdThisWeek ?? 0,
      readyThisWeek: readyThisWeek ?? 0,
      promotedThisWeek: promotedThisWeek ?? 0,
      pendingDrafts: pendingDrafts ?? 0,
      pendingReady: pendingReady ?? 0,
    });
  });
}
