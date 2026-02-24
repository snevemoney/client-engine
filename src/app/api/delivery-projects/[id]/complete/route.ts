/**
 * POST /api/delivery-projects/[id]/complete — Mark completed (with readiness validation).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { computeDeliveryCompletionReadiness } from "@/lib/delivery/readiness";

const PostSchema = z.object({
  force: z.boolean().optional().default(false),
  proofRequested: z.boolean().optional().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/complete", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({
      where: { id },
      include: {
        checklistItems: true,
        milestones: true,
        intakeLead: true,
      },
    });
    if (!project) return jsonError("Project not found", 404);

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const force = parsed.success ? parsed.data.force : false;
    const proofRequested = parsed.success ? parsed.data.proofRequested : true;

    const readiness = computeDeliveryCompletionReadiness(
      project,
      project.checklistItems,
      project.milestones,
      { force }
    );
    if (!readiness.canComplete) {
      return jsonError(
        `Cannot complete: ${readiness.reasons.join("; ")}`,
        400,
        "READINESS"
      );
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          status: "completed",
          completedAt: now,
          proofRequestedAt: proofRequested ? now : undefined,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "completed",
          message: "Project marked completed",
          metaJson: { proofRequested },
        },
      });

      if (project.intakeLeadId && project.intakeLead) {
        const intake = project.intakeLead;
        const updates: Record<string, unknown> = { deliveryCompletedAt: now };
        if (!intake.githubUrl && project.githubUrl) updates.githubUrl = project.githubUrl;
        if (!intake.loomUrl && project.loomUrl) updates.loomUrl = project.loomUrl;
        await tx.intakeLead.update({
          where: { id: project.intakeLeadId },
          data: updates,
        });
      }
    });

    return NextResponse.json({
      status: "completed",
      completedAt: now.toISOString(),
      proofRequestedAt: proofRequested ? now.toISOString() : null,
    });
  });
}
