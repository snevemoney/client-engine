/**
 * PATCH /api/delivery-projects/[id]/milestones/[milestoneId] — Update milestone status.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const PatchSchema = z.object({
  status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  return withRouteTiming("PATCH /api/delivery-projects/[id]/milestones/[milestoneId]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id, milestoneId } = await params;

    const milestone = await db.deliveryMilestone.findFirst({
      where: { id: milestoneId, deliveryProjectId: id },
    });
    if (!milestone) return jsonError("Milestone not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(parsed.error.issues.map((e) => e.message).join("; "), 400);
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      if (parsed.data.status === "done") data.completedAt = new Date();
      else if (milestone.status === "done") data.completedAt = null;
    }
    if (parsed.data.title !== undefined) data.title = parsed.data.title;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;

    const updated = await db.deliveryMilestone.update({
      where: { id: milestoneId },
      data,
    });

    if (parsed.data.status && parsed.data.status !== milestone.status) {
      await db.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "milestone",
          message: `Milestone "${updated.title}" → ${parsed.data.status.replace(/_/g, " ")}`,
          metaJson: { milestoneId, from: milestone.status, to: parsed.data.status },
        },
      });
    }

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      description: updated.description ?? null,
      status: updated.status,
      sortOrder: updated.sortOrder,
      completedAt: updated.completedAt?.toISOString() ?? null,
    });
  });
}
