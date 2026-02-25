/**
 * GET /api/delivery-projects/gaps-summary — Delivery hygiene gaps.
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { withSummaryCache } from "@/lib/http/cached-handler";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/delivery-projects/gaps-summary", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    return withSummaryCache("delivery-projects/gaps-summary", async () => {
      const projects = await db.deliveryProject.findMany({
      where: { status: { notIn: ["archived"] } },
      include: {
        checklistItems: true,
      },
    });

    let missingGithubLoom = 0;
    let qaIncomplete = 0;
    let handoffIncomplete = 0;
    let completedNoProofCandidate = 0;

    for (const p of projects) {
      if (!p.githubUrl && !p.loomUrl && ["in_progress", "qa", "completed"].includes(p.status)) {
        missingGithubLoom++;
      }
      const qaRequired = p.checklistItems.filter((c) => c.category === "qa" && c.isRequired && !c.isDone);
      if (qaRequired.length > 0) qaIncomplete++;
      const handoffRequired = p.checklistItems.filter((c) => c.category === "handoff" && c.isRequired && !c.isDone);
      if (handoffRequired.length > 0) handoffIncomplete++;
      if (p.status === "completed" && !p.proofCandidateId) completedNoProofCandidate++;
    }

      return {
        missingGithubLoom,
        qaIncomplete,
        handoffIncomplete,
        completedNoProofCandidate,
      };
    }, 15_000);
  });
}
