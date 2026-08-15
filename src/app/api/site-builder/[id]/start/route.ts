/**
 * POST /api/site-builder/[id]/start
 *
 * Initialize SiteBuildPlan for a delivery project. Creates plan + 9 phase records (pending).
 * Optionally enqueues Phase 1 job. For Sprint 1, runs Phase 1 inline.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { PHASE_CONFIG } from "@/lib/site-builder/constants";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRouteTiming("POST /api/site-builder/[id]/start", async () => {
    const { id: deliveryProjectId } = await params;
    const result = await requireDeliveryProject(deliveryProjectId);
    if (!result.ok) return result.response;
    if (!result.project.pipelineLeadId) {
      return jsonError("SBP requires a pipeline Lead; project has none", 400, "NO_PIPELINE_LEAD");
    }

    const existing = await db.siteBuildPlan.findUnique({
      where: { deliveryProjectId },
    });
    if (existing) {
      return jsonError("Site build plan already exists for this project", 409, "ALREADY_EXISTS");
    }

    const plan = await db.siteBuildPlan.create({
      data: {
        deliveryProjectId,
        status: "speccing",
        currentPhase: 1,
        phasesCompleted: [],
        phases: {
          create: PHASE_CONFIG.map((p) => ({
            phaseNum: p.num,
            phaseName: p.skill,
            status: "pending",
          })),
        },
      },
      include: { phases: true },
    });

    return NextResponse.json({
      id: plan.id,
      deliveryProjectId: plan.deliveryProjectId,
      status: plan.status,
      currentPhase: plan.currentPhase,
      phases: plan.phases,
    });
  });
}
