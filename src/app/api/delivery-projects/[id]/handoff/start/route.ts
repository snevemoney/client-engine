/**
 * POST /api/delivery-projects/[id]/handoff/start — Start handoff.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { logInteraction } from "@/lib/interactions/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/handoff/start", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project, session } = result;

    const now = new Date();
    if (project.handoffStartedAt) {
      return NextResponse.json({
        handoffStartedAt: project.handoffStartedAt.toISOString(),
        message: "Handoff already started",
      });
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: { handoffStartedAt: now },
      });
      const activity = await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "handoff_started" as DeliveryActivityType,
          message: "Handoff started",
        },
      });
      await logInteraction({
        category: "handoff_started",
        summary: "Handoff started for delivery project",
        deliveryProjectId: id,
        channel: "in_app",
        direction: "outbound",
        actorType: "user",
        actorId: session.user?.id,
        sourceModel: "DeliveryActivity",
        sourceId: activity.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, tx as any);
    });

    return NextResponse.json({ handoffStartedAt: now.toISOString() });
  });
}
