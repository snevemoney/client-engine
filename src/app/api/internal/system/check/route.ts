/**
 * GET /api/internal/system/check — System readiness check (auth required).
 * Phase 2.9: Channels, scheduler, defaults, health.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { runSystemCheck } from "@/lib/notifications/system-check";

export const dynamic = "force-dynamic";

export async function GET() {
  return withRouteTiming("GET /api/internal/system/check", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const result = await runSystemCheck();
    return NextResponse.json(result);
  });
}
