/**
 * POST /api/delivery-projects/[id]/request-proof — Set proofRequestedAt.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/request-proof", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;

    const now = new Date();

    await db.$transaction([
      db.deliveryProject.update({
        where: { id },
        data: { proofRequestedAt: now },
      }),
      db.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "handoff",
          message: "Proof requested",
        },
      }),
    ]);

    return NextResponse.json({ proofRequestedAt: now.toISOString() });
  });
}
