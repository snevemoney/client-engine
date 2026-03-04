/**
 * PATCH /api/cadence/[id]
 * Snooze or complete a cadence. Auth: session.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { logOpsEventSafe } from "@/lib/ops-events/log";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  snoozedUntil: z.union([z.string().datetime(), z.null()]).optional(),
  completedAt: z.literal(true).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/cadence/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const existing = await db.cadence.findUnique({ where: { id } });
    if (!existing) return jsonError("Cadence not found", 404);

    const updates: { snoozedUntil?: Date | null; completedAt?: Date | null } = {};
    if (parsed.data.snoozedUntil !== undefined) {
      updates.snoozedUntil = parsed.data.snoozedUntil ? new Date(parsed.data.snoozedUntil) : null;
    }
    if (parsed.data.completedAt === true) {
      updates.completedAt = new Date();
    }

    if (Object.keys(updates).length === 0) {
      return jsonError("No updates provided", 400);
    }

    const updated = await db.cadence.update({
      where: { id },
      data: updates,
    });

    logOpsEventSafe({
      category: "api_action",
      eventKey: "cadence.updated",
      meta: { cadenceId: id, sourceType: existing.sourceType, sourceId: existing.sourceId },
    });

    return NextResponse.json({
      id: updated.id,
      sourceType: updated.sourceType,
      sourceId: updated.sourceId,
      trigger: updated.trigger,
      dueAt: updated.dueAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
      snoozedUntil: updated.snoozedUntil?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    });
  });
}
