/**
 * POST /api/delivery-projects/[id]/retention/status — Update retention status.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DeliveryActivityType, RetentionStatus } from "@prisma/client";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

const RETENTION_STATUSES = [
  "none",
  "monitoring",
  "followup_due",
  "upsell_open",
  "retainer_open",
  "closed_won",
  "closed_lost",
] as const;

const PostSchema = z.object({
  retentionStatus: z.enum(RETENTION_STATUSES),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/retention/status", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const project = await db.deliveryProject.findUnique({ where: { id } });
    if (!project) return jsonError("Project not found", 404);

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("retentionStatus required", 400, "VALIDATION");
    }
    const body = parsed.data;

    const prevStatus = project.retentionStatus;
    const newStatus = body.retentionStatus as RetentionStatus;

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: { retentionStatus: newStatus },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "retention_status_changed" as DeliveryActivityType,
          message: body.note ?? `Retention status: ${prevStatus} → ${newStatus}`,
          metaJson: { prevStatus, newStatus },
        },
      });
    });

    return NextResponse.json({ retentionStatus: newStatus });
  });
}
