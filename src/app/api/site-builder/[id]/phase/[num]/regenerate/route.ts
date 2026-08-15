/**
 * POST /api/site-builder/[id]/phase/[num]/regenerate
 *
 * Re-run a phase with operatorNotes injected into the prompt. Increments retryCount.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { runSitePhase } from "@/lib/site-builder/orchestrator";

const PostSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; num: string }> },
) {
  return withRouteTiming("POST /api/site-builder/[id]/phase/[num]/regenerate", async () => {
    const { id: deliveryProjectId, num } = await params;
    const phaseNum = parseInt(num, 10);
    if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 9) {
      return jsonError("Invalid phase number (1-9)", 400, "VALIDATION");
    }

    const result = await requireDeliveryProject(deliveryProjectId);
    if (!result.ok) return result.response;

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    const notes = parsed.success ? parsed.data.notes : undefined;

    const plan = await db.siteBuildPlan.findUnique({
      where: { deliveryProjectId },
      include: { phases: true },
    });
    if (!plan) return jsonError("No site build plan", 404, "NOT_FOUND");

    const phase = plan.phases.find((p) => p.phaseNum === phaseNum);
    if (!phase) return jsonError("Phase " + phaseNum + " not found", 404, "NOT_FOUND");

    await db.siteBuildPhase.update({
      where: { id: phase.id },
      data: {
        status: "pending",
        outputArtifactId: null,
        operatorNotes: notes ?? null,
        retryCount: { increment: 1 },
      },
    });

    const runResult = await runSitePhase(plan.id, phaseNum, notes);

    const userId = result.session?.user?.id ?? "system";
    const { ingestFromSitePhaseRevised } = await import("@/lib/memory/site-builder-ingest");
    ingestFromSitePhaseRevised(deliveryProjectId, phaseNum, userId, notes).catch(() => {});

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
