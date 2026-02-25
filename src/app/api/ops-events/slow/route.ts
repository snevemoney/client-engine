/**
 * GET /api/ops-events/slow — Recent slow events
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/ops-events/slow", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const threshold = Math.max(parseInt(url.searchParams.get("threshold") ?? "1500", 10) || 1500, 100);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);

    const items = await db.opsEvent.findMany({
      where: { durationMs: { gte: threshold } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        eventKey: true,
        eventLabel: true,
        route: true,
        method: true,
        durationMs: true,
        sourceType: true,
        sourceId: true,
      },
    });

    return NextResponse.json({
      items: items.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        eventKey: e.eventKey,
        eventLabel: e.eventLabel ?? null,
        route: e.route ?? null,
        method: e.method ?? null,
        durationMs: e.durationMs ?? null,
        sourceType: e.sourceType ?? null,
        sourceId: e.sourceId ?? null,
      })),
    });
  });
}
