/**
 * POST /api/site-builder/[id]/phase/[num]/run
 *
 * Trigger a phase run. Validates prior phases complete. Runs phase inline.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { runSitePhase } from "@/lib/site-builder/orchestrator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; num: string }> },
) {
  return withRouteTiming("POST /api/site-builder/[id]/phase/[num]/run", async () => {
    const { id: deliveryProjectId, num } = await params;
    const phaseNum = parseInt(num, 10);
    if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 9) {
      return jsonError("Invalid phase number (1-9)", 400, "VALIDATION");
    }

    const result = await requireDeliveryProject(deliveryProjectId);
    if (!result.ok) return result.response;

    const plan = await db.siteBuildPlan.findUnique({
      where: { deliveryProjectId },
    });
    if (!plan) return jsonError("No site build plan; call POST /api/site-builder/[id]/start first", 404, "NOT_FOUND");

    const runResult = await runSitePhase(plan.id, phaseNum);

    if (!runResult.ok) {
      return jsonError(runResult.error, 400, "PHASE_FAILED");
    }

    return NextResponse.json({
      ok: true,
      phaseNum,
      artifactId: runResult.artifactId,
      output: runResult.output,
    });
  });
}
