/**
 * POST /api/delivery-projects/[id]/handoff/complete — Complete handoff.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { computeHandoffReadiness } from "@/lib/delivery/handoff-readiness";

const PostSchema = z.object({
  handoffSummary: z.string().max(10000).optional().nullable(),
  handoffOwner: z.string().max(200).optional().nullable(),
  force: z.boolean().optional().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/handoff/complete", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id, { include: { checklistItems: true } });
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const body = parsed.success ? parsed.data : { handoffSummary: null, handoffOwner: null, force: false };

    if (!body.force) {
      const readiness = computeHandoffReadiness(project, project.checklistItems);
      if (!readiness.isReadyForHandoff) {
        return jsonError(
          `Not ready for handoff: ${readiness.reasons.join("; ")}`,
          400,
          "READINESS"
        );
      }
    }

    const now = new Date();
    if (project.handoffCompletedAt) {
      const updated = await db.deliveryProject.update({
        where: { id },
        data: {
          handoffSummary: body.handoffSummary ?? project.handoffSummary,
          handoffOwner: body.handoffOwner ?? project.handoffOwner,
        },
      });
      return NextResponse.json({
        handoffCompletedAt: updated.handoffCompletedAt?.toISOString() ?? null,
        handoffSummary: updated.handoffSummary ?? null,
        handoffOwner: updated.handoffOwner ?? null,
        message: "Handoff already completed; summary/owner updated",
      });
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          handoffCompletedAt: now,
          handoffSummary: body.handoffSummary ?? undefined,
          handoffOwner: body.handoffOwner ?? undefined,
          handoffStartedAt: project.handoffStartedAt ?? now,
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "handoff_completed" as DeliveryActivityType,
          message: "Handoff completed",
          metaJson: { handoffSummary: body.handoffSummary, handoffOwner: body.handoffOwner },
        },
      });
    });

    return NextResponse.json({
      handoffCompletedAt: now.toISOString(),
      handoffSummary: body.handoffSummary ?? null,
      handoffOwner: body.handoffOwner ?? null,
    });
  });
}
