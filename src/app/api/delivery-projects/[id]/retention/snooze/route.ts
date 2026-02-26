/**
 * POST /api/delivery-projects/[id]/retention/snooze — Snooze retention follow-up.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { jsonError, requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";
import { computeRetentionNextDate, type RetentionSnoozePreset } from "@/lib/delivery/retention";

const PostSchema = z.object({
  preset: z.enum(["7d", "14d", "30d", "next_month", "custom"]),
  customDate: z.string().datetime().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/retention/snooze", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError("preset (7d|14d|30d|next_month|custom) required", 400, "VALIDATION");
    }
    const body = parsed.data;

    const fromDate =
      project.retentionNextFollowUpAt ?? project.retentionLastContactedAt ?? new Date();
    const nextFollowUpAt = computeRetentionNextDate(
      { preset: body.preset as RetentionSnoozePreset, customDate: body.customDate },
      fromDate instanceof Date ? fromDate : new Date(fromDate)
    );

    if (!nextFollowUpAt) {
      return jsonError(
        body.preset === "custom" ? "customDate required for custom preset" : "Invalid date",
        400,
        "VALIDATION"
      );
    }

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data: { retentionNextFollowUpAt: nextFollowUpAt },
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "retention_followup_scheduled" as DeliveryActivityType,
          message: `Snoozed to ${body.preset}`,
          metaJson: { preset: body.preset, nextFollowUpAt: nextFollowUpAt.toISOString() },
        },
      });
    });

    return NextResponse.json({
      retentionNextFollowUpAt: nextFollowUpAt.toISOString(),
    });
  });
}
