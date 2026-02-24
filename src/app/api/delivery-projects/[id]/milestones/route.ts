/**
 * POST /api/delivery-projects/[id]/milestones — Add milestone.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  title: z.string().min(1, "Title required").max(500),
  description: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/milestones", async () => {
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
    const body = parsed.data;

    const maxOrder = await db.deliveryMilestone.aggregate({
      where: { deliveryProjectId: id },
      _max: { sortOrder: true },
    });
    const sortOrder = body.sortOrder ?? ((maxOrder._max.sortOrder ?? 0) + 10);

    const milestone = await db.deliveryMilestone.create({
      data: {
        deliveryProjectId: id,
        title: body.title,
        description: body.description ?? undefined,
        sortOrder,
      },
    });

    await db.deliveryActivity.create({
      data: {
        deliveryProjectId: id,
        type: "milestone",
        message: `Milestone added: ${body.title}`,
        metaJson: { milestoneId: milestone.id },
      },
    });

    return NextResponse.json(
      {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description ?? null,
        status: milestone.status,
        sortOrder: milestone.sortOrder,
      },
      { status: 201 }
    );
  });
}
