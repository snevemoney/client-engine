/**
 * PATCH /api/reminders/[id] — Update reminder.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { computeSnoozeUntil, type SnoozePreset } from "@/lib/reminders/dates";
import { normalizePriority } from "@/lib/reminders/priorities";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/reminders/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Missing id", 400);

    try {
      const body = await req.json().catch(() => ({}));
      const updates: Record<string, unknown> = {};

      if (body.status !== undefined) {
        const s = String(body.status).toLowerCase();
        if (["open", "snoozed", "done", "dismissed"].includes(s)) {
          updates.status = s;
          if (s === "done") updates.completedAt = new Date();
          if (s === "dismissed") updates.dismissedAt = new Date();
        }
      }

      if (body.snoozePreset) {
        const preset = body.snoozePreset as SnoozePreset;
        const until = computeSnoozeUntil(preset, new Date(), body.snoozeCustomDate);
        if (until) {
          updates.snoozedUntil = until;
          updates.status = "snoozed";
        }
      }
      if (body.snoozedUntil) {
        const d = new Date(body.snoozedUntil);
        if (!Number.isNaN(d.getTime())) {
          updates.snoozedUntil = d;
          updates.status = "snoozed";
        }
      }

      if (body.title !== undefined) updates.title = String(body.title);
      if (body.description !== undefined) updates.description = body.description == null ? null : String(body.description);
      if (body.priority !== undefined) updates.priority = normalizePriority(body.priority);
      if (body.dueAt !== undefined) {
        const d = body.dueAt == null ? null : new Date(body.dueAt);
        updates.dueAt = d && !Number.isNaN(d.getTime()) ? d : null;
      }

      if (Object.keys(updates).length === 0) {
        return jsonError("No valid updates", 400);
      }

      const reminder = await db.opsReminder.update({
        where: { id },
        data: updates,
      });

      return NextResponse.json({
        id: reminder.id,
        status: reminder.status,
        snoozedUntil: reminder.snoozedUntil?.toISOString() ?? null,
        completedAt: reminder.completedAt?.toISOString() ?? null,
      });
    } catch (err) {
      console.error("[reminders PATCH]", err);
      return jsonError("Failed to update reminder", 500);
    }
  });
}
