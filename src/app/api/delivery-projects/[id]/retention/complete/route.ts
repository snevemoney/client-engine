/**
 * POST /api/delivery-projects/[id]/retention/complete — Complete retention follow-up.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DeliveryActivityType } from "@prisma/client";
import { requireDeliveryProject, withRouteTiming } from "@/lib/api-utils";

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
  outcome: z.string().max(500).optional().nullable(),
  retentionStatus: z.enum(RETENTION_STATUSES).optional().nullable(),
  upsellOpportunity: z.string().max(1000).optional().nullable(),
  upsellValueEstimate: z.number().int().min(0).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/delivery-projects/[id]/retention/complete", async () => {
    const { id } = await params;
    const result = await requireDeliveryProject(id);
    if (!result.ok) return result.response;
    const { project } = result;

    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    const body = parsed.success ? parsed.data : {};

    const now = new Date();
    const prevStatus = project.retentionStatus;
    const newStatus = body.retentionStatus ?? prevStatus;
    const statusChanged = newStatus !== prevStatus;

    const data: Record<string, unknown> = {
      retentionOutcome: body.outcome ?? project.retentionOutcome,
      retentionStatus: newStatus,
      retentionLastContactedAt: now,
      retentionFollowUpCount: (project.retentionFollowUpCount ?? 0) + 1,
    };
    if (body.upsellOpportunity !== undefined) data.upsellOpportunity = body.upsellOpportunity ?? null;
    if (body.upsellValueEstimate !== undefined)
      data.upsellValueEstimate = body.upsellValueEstimate ?? null;

    await db.$transaction(async (tx) => {
      await tx.deliveryProject.update({
        where: { id },
        data,
      });
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: id,
          type: "retention_followup_completed" as DeliveryActivityType,
          message: body.note ?? "Retention follow-up completed",
          metaJson: {
            outcome: body.outcome,
            retentionStatus: newStatus,
            upsellOpportunity: body.upsellOpportunity,
            upsellValueEstimate: body.upsellValueEstimate,
          },
        },
      });
      if (statusChanged) {
        await tx.deliveryActivity.create({
          data: {
            deliveryProjectId: id,
            type: "retention_status_changed" as DeliveryActivityType,
            message: `Retention status: ${prevStatus} → ${newStatus}`,
            metaJson: { prevStatus, newStatus },
          },
        });
      }
    });

    return NextResponse.json({
      retentionOutcome: data.retentionOutcome,
      retentionStatus: newStatus,
      retentionLastContactedAt: now.toISOString(),
      retentionFollowUpCount: data.retentionFollowUpCount,
      upsellOpportunity: data.upsellOpportunity ?? null,
      upsellValueEstimate: data.upsellValueEstimate ?? null,
    });
  });
}
