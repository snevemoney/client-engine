/**
 * GET /api/site-builder/[id]/phase/[num]/output
 *
 * Fetch the structured JSON output of a phase. Cached (TTL 60s).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { getOrSet } from "@/lib/cache/memory-cache";
import { shortCacheHeaders } from "@/lib/http/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; num: string }> },
) {
  return withRouteTiming("GET /api/site-builder/[id]/phase/[num]/output", async () => {
    const { id: deliveryProjectId, num } = await params;
    const phaseNum = parseInt(num, 10);
    if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 9) {
      return jsonError("Invalid phase number (1-9)", 400, "VALIDATION");
    }

    const result = await requireDeliveryProject(deliveryProjectId);
    if (!result.ok) return result.response;

    const output = await getOrSet(
      `site-builder:output:${deliveryProjectId}:${phaseNum}`,
      60_000,
      async () => {
        const plan = await db.siteBuildPlan.findUnique({
          where: { deliveryProjectId },
          include: {
            phases: {
              where: { phaseNum },
              include: { outputArtifact: true },
            },
          },
        });
        if (!plan) return null;
        const phase = plan.phases[0];
        if (!phase?.outputArtifact?.meta) return null;
        return phase.outputArtifact.meta as Record<string, unknown>;
      },
    );

    if (!output) {
      return jsonError("Phase output not found", 404, "NOT_FOUND");
    }

    return NextResponse.json(output, {
      headers: shortCacheHeaders(60),
    });
  });
}
