/**
 * POST /api/delivery-projects/[id]/request-proof — Set proofRequestedAt.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/request-proof", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

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
