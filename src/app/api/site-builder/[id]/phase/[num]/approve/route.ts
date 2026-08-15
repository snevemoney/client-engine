/**
 * POST /api/site-builder/[id]/phase/[num]/approve
 *
 * Approve a completed phase. Optionally trigger next phase.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  notes: z.string().max(2000).optional(),
  autoProceed: z.boolean().optional().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; num: string }> },
) {
  return withRouteTiming("POST /api/site-builder/[id]/phase/[num]/approve", async () => {
    const { id: deliveryProjectId, num } = await params;
    const phaseNum = parseInt(num, 10);
    if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 9) {
      return jsonError("Invalid phase number (1-9)", 400, "VALIDATION");
    }

    const result = await requireDeliveryProject(deliveryProjectId);
    if (!result.ok) return result.response;
    const userId = result.session?.user?.id ?? "system";

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    const body = parsed.success ? parsed.data : { notes: undefined, autoProceed: false };

    const plan = await db.siteBuildPlan.findUnique({
      where: { deliveryProjectId },
      include: { phases: { orderBy: { phaseNum: "asc" } } },
    });
    if (!plan) return jsonError("No site build plan", 404, "NOT_FOUND");

    const phase = plan.phases.find((p) => p.phaseNum === phaseNum);
    if (!phase) return jsonError("Phase " + phaseNum + " not found", 404, "NOT_FOUND");
    if (phase.status !== "complete") {
      return jsonError("Phase must be complete to approve (current: " + phase.status + ")", 400, "INVALID_STATE");
    }

    await db.siteBuildPhase.update({
      where: { id: phase.id },
      data: {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: userId,
        operatorNotes: body.notes ?? null,
      },
    });

    const { ingestFromSitePhaseApproved } = await import("@/lib/memory/site-builder-ingest");
    ingestFromSitePhaseApproved(deliveryProjectId, phaseNum, userId, {
      phaseName: phase.phaseName,
    }).catch(() => {});

    const phasesCompleted = [...plan.phasesCompleted];
    if (!phasesCompleted.includes(phaseNum)) {
      phasesCompleted.push(phaseNum);
      phasesCompleted.sort((a, b) => a - b);
    }

    await db.siteBuildPlan.update({
      where: { id: plan.id },
      data: {
        phasesCompleted,
        currentPhase: phaseNum < 9 ? phaseNum + 1 : null,
      },
    });

    return NextResponse.json({
      ok: true,
      phaseNum,
      phasesCompleted,
      autoProceed: body.autoProceed,
    });
  });
}
