/**
 * POST /api/delivery-projects/[id]/handoff/start — Start handoff.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/handoff/start", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

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
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "handoff_started" as DeliveryActivityType,
          message: "Handoff started",
        },
      });
    });

    return NextResponse.json({ handoffStartedAt: now.toISOString() });
  });
}
