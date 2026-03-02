/**
 * POST /api/delivery-projects/[id]/client-confirm — Mark client confirmed handoff.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { logInteraction } from "@/lib/interactions/service";

const PostSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/client-confirm", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project, session } = result;

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const note = parsed.success ? parsed.data.note : null;

    const now = new Date();
    if (project.clientConfirmedAt) {
      return NextResponse.json({
        clientConfirmedAt: project.clientConfirmedAt.toISOString(),
        message: "Client already confirmed",
      });
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: { clientConfirmedAt: now },
      });
      const activity = await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "client_confirmed" as DeliveryActivityType,
          message: note ?? "Client confirmed handoff",
          metaJson: note ? { note } : undefined,
        },
      });
      await logInteraction({
        category: "client_confirmed",
        summary: "Client confirmed delivery handoff",
        deliveryProjectId: id,
        channel: "in_app",
        direction: "inbound",
        actorType: "user",
        actorId: session.user?.id,
        sourceModel: "DeliveryActivity",
        sourceId: activity.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, tx as any);
    });

    return NextResponse.json({ clientConfirmedAt: now.toISOString() });
  });
}
