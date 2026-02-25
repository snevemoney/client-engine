/**
 * POST /api/delivery-projects/[id]/referral/decline — Decline referral.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/referral/decline", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

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
