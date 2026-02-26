/**
 * POST /api/delivery-projects/[id]/checklist/toggle — Toggle checklist item.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

const PostSchema = z.object({
  itemId: z.string().cuid(),
  isDone: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/checklist/toggle", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("Invalid request: itemId and isDone required", 400, "VALIDATION");
    }
    const { itemId, isDone } = parsed.data;

    const item = await db.deliveryChecklistItem.findFirst({
      where: { id: itemId, deliveryProjectId: id },
    });
    if (!item) return jsonError("Checklist item not found", 404);

    const now = new Date();
    const updated = await db.deliveryChecklistItem.update({
      where: { id: itemId },
      data: { isDone, doneAt: isDone ? now : null },
    });

    await db.deliveryActivity.create({
      data: {
        deliveryProjectId: id,
        type: "checklist",
        message: `${item.label}: ${isDone ? "done" : "undone"}`,
        metaJson: { itemId, isDone },
      },
    });

    return NextResponse.json({
      id: updated.id,
      isDone: updated.isDone,
      doneAt: updated.doneAt?.toISOString() ?? null,
    });
  });
}
