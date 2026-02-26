/**
 * POST /api/delivery-projects/[id]/referral/decline — Decline referral.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/referral/decline", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    if (project.referralStatus === "declined") {
      return NextResponse.json({
        referralStatus: "declined",
        message: "Referral already declined",
      });
    }

    await db.deliveryProject.update({
      where: { id },
      data: { referralStatus: "declined" },
    });

    return NextResponse.json({ referralStatus: "declined" });
  });
}
