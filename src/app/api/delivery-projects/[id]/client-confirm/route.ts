/**
 * POST /api/delivery-projects/[id]/client-confirm — Mark client confirmed handoff.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/client-confirm", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

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
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "client_confirmed" as DeliveryActivityType,
          message: note ?? "Client confirmed handoff",
          metaJson: note ? { note } : undefined,
        },
      });
    });

    return NextResponse.json({ clientConfirmedAt: now.toISOString() });
  });
}
