/**
 * POST /api/in-app-notifications/[id]/read — Mark one read (idempotent).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { markRead } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/in-app-notifications/[id]/read", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    await markRead(id);
    return NextResponse.json({ ok: true });
  });
}
