/**
 * PATCH /api/delivery-milestones/[id] — Update milestone.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryMilestoneStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const STATUSES: DeliveryMilestoneStatus[] = ["todo", "in_progress", "done", "blocked"];

const PatchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(STATUSES as unknown as [string, ...string[]]).optional(),
  sortOrder: z.number().int().min(0).optional(),
  dueAt: z.string().datetime().optional().nullable().or(z.literal("")),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/delivery-milestones/[id]", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const milestone = await db.deliveryMilestone.findUnique({
      where: { id },
      include: { deliveryProject: true },
    });
    if (!milestone) return jsonError("Milestone not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return jsonError(msg || "Invalid request body", 400, "VALIDATION");
    }
    const body = parsed.data;

    const data: Record<string, unknown> = {};
    if (body.title != null) data.title = body.title;
    if (body.description !== undefined) data.description = body.description ?? null;
    if (body.status != null) data.status = body.status as DeliveryMilestoneStatus;
    if (body.sortOrder != null) data.sortOrder = body.sortOrder;
    if (body.dueAt !== undefined) {
      const v = body.dueAt?.trim();
      data.dueAt = v ? new Date(v) : null;
    }
    if (body.status === "done") {
      data.completedAt = new Date();
    }

    const updated = await db.deliveryMilestone.update({
      where: { id },
      data,
    });

    await db.deliveryActivity.create({
      data: {
        deliveryProjectId: milestone.deliveryProjectId,
        type: "milestone",
        message: `Milestone updated: ${updated.title}`,
        metaJson: { milestoneId: id, status: updated.status },
      },
    });

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
