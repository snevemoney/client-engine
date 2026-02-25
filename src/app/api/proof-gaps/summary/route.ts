/**
 * GET /api/proof-gaps/summary — Proof gap metrics for command center.
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProofCandidateStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";
import { getWeekStart } from "@/lib/ops/weekStart";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/proof-gaps/summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    return withSummaryCache("proof-gaps/summary", async () => {
      const now = new Date();
    const startOfWeek = getWeekStart(now);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const [
      wonLeadsWithoutProofCandidate,
      readyCandidatesPendingPromotion,
      proofRecordsMissingFields,
      promotedThisWeek,
    ] = await Promise.all([
      db.intakeLead.count({
        where: {
          status: "won",
          proofCandidates: { none: {} },
          proofRecords: { none: {} },
        },
      }),
      db.proofCandidate.count({
        where: { status: ProofCandidateStatus.ready },
      }),
      db.proofRecord.count({
        where: {
          OR: [
            { proofSnippet: null },
            { proofSnippet: "" },
            { afterState: null },
            { afterState: "" },
          ],
        },
      }),
      db.proofCandidate.count({
        where: {
          status: ProofCandidateStatus.promoted,
          promotedAt: { gte: startOfWeek, lte: endOfWeek },
        },
      }),
    ]);

      return {
        wonLeadsWithoutProofCandidate: wonLeadsWithoutProofCandidate ?? 0,
        readyCandidatesPendingPromotion: readyCandidatesPendingPromotion ?? 0,
        proofRecordsMissingFields: proofRecordsMissingFields ?? 0,
        promotedThisWeek: promotedThisWeek ?? 0,
      };
    }, 15_000);
  });
}
