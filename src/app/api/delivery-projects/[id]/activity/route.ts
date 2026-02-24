/**
 * POST /api/delivery-projects/[id]/activity — Add note.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  message: z.string().min(1, "Message required").max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/activity", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }

    const activity = await db.deliveryActivity.create({
      data: {
        deliveryProjectId: id,
        type: "note" as DeliveryActivityType,
        message: parsed.data.message,
      },
    });

    return NextResponse.json(
      {
        id: activity.id,
        type: activity.type,
        message: activity.message,
        createdAt: activity.createdAt.toISOString(),
      },
      { status: 201 }
    );
  });
}
