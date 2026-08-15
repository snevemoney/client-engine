/**
 * GET /api/site-builder/[id]/plan
 *
 * Fetch SiteBuildPlan with all SiteBuildPhase records for a delivery project.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming("GET /api/site-builder/[id]/plan", async () => {
    const { id: deliveryProjectId } = await params;
    const result = await requireDeliveryProject(deliveryProjectId);
    if (!result.ok) return result.response;

    const plan = await db.siteBuildPlan.findUnique({
      where: { deliveryProjectId },
      include: {
        phases: {
          orderBy: { phaseNum: "asc" },
          include: { outputArtifact: { select: { id: true, type: true, title: true, createdAt: true } } },
        },
      },
    });

    if (!plan) {
      return jsonError("No site build plan for this project", 404, "NOT_FOUND");
    }

    return NextResponse.json(plan);
  });
}
