/**
 * POST /api/in-app-notifications/read-all — Mark all unread as read.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { markAllRead } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function POST() {
  return withRouteTiming("POST /api/in-app-notifications/read-all", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const result = await markAllRead();
    return NextResponse.json({ ok: true, count: result.count });
  });
}
