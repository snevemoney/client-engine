/**
 * POST /api/delivery-projects/[id]/referral/request — Request referral.
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
  return withRouteTiming("POST /api/delivery-projects/[id]/referral/request", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

    const now = new Date();
    if (project.referralStatus === "requested" && project.referralRequestedAt) {
      return NextResponse.json({
        referralRequestedAt: project.referralRequestedAt.toISOString(),
        referralStatus: "requested",
        message: "Referral already requested",
      });
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: {
          referralRequestedAt: now,
          referralStatus: "requested",
        },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "referral_requested" as DeliveryActivityType,
          message: "Referral requested",
        },
      });
    });

    return NextResponse.json({
      referralRequestedAt: now.toISOString(),
      referralStatus: "requested",
    });
  });
}
