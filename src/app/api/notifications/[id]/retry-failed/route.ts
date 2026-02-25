/**
 * POST /api/notifications/[id]/retry-failed — Retry failed deliveries for an event.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { retryFailedDelivery } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/notifications/[id]/retry-failed", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const event = await db.notificationEvent.findUnique({
      where: { id },
      include: { deliveries: { where: { status: "failed" } } },
    });
    if (!event) return jsonError("Event not found", 404);

    let retried = 0;
    for (const d of event.deliveries) {
      await retryFailedDelivery(d.id);
      retried++;
    }

    return NextResponse.json({ ok: true, retried });
  });
}
