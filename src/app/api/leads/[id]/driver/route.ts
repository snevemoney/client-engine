/**
 * PATCH /api/leads/[id]/driver — Update driver fields (reason → result → deadline, next action, proof angle)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const driverSchema = z.object({
  driverType: z.enum(["survival", "status", "freedom", "cause", "competition", "enemy", "unknown"]).optional().nullable(),
  driverReason: z.string().max(2000).optional().nullable(),
  desiredResult: z.string().max(2000).optional().nullable(),
  resultDeadline: z.union([z.string(), z.null()]).optional(),
  nextAction: z.string().max(1000).optional().nullable(),
  nextActionDueAt: z.union([z.string(), z.null()]).optional(),
  proofAngle: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRouteTiming("PATCH /api/leads/[id]/driver", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const parsed = driverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const update: Record<string, unknown> = {};
    if (data.driverType !== undefined) update.driverType = data.driverType;
    if (data.driverReason !== undefined) update.driverReason = data.driverReason;
    if (data.desiredResult !== undefined) update.desiredResult = data.desiredResult;
    if (data.resultDeadline !== undefined) update.resultDeadline = data.resultDeadline && data.resultDeadline !== "" ? new Date(data.resultDeadline as string) : null;
    if (data.nextAction !== undefined) update.nextAction = data.nextAction;
    if (data.nextActionDueAt !== undefined) update.nextActionDueAt = data.nextActionDueAt && data.nextActionDueAt !== "" ? new Date(data.nextActionDueAt as string) : null;
    if (data.proofAngle !== undefined) update.proofAngle = data.proofAngle;

    const updated = await db.lead.update({
      where: { id },
      data: update,
    });
    return NextResponse.json(updated);
  });
}
