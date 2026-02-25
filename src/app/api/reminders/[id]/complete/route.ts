/**
 * POST /api/reminders/[id]/complete — Mark reminder done.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/reminders/[id]/complete", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Missing id", 400);

    try {
      const reminder = await db.opsReminder.update({
        where: { id },
        data: { status: "done", completedAt: new Date() },
      });

      return NextResponse.json({
        id: reminder.id,
        status: reminder.status,
        completedAt: reminder.completedAt?.toISOString(),
      });
    } catch (err) {
      console.error("[reminders complete]", err);
      return jsonError("Failed to complete reminder", 500);
    }
  });
}
