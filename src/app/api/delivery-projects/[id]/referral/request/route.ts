/**
 * POST /api/delivery-projects/[id]/referral/request — Request referral.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/referral/request", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

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
