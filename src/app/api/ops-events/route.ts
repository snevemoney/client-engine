/**
 * GET /api/ops-events — List telemetry events with filters
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const CATEGORIES = ["ui_action", "api_action", "page_view", "system", "audit", "automation", "integration", "data_quality"] as const;
const LEVELS = ["info", "warn", "error"] as const;
const STATUSES = ["started", "success", "failure", "skipped"] as const;

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/ops-events", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const level = url.searchParams.get("level");
    const status = url.searchParams.get("status");
    const eventKey = url.searchParams.get("eventKey");
    const sourceType = url.searchParams.get("sourceType");
    const sourceId = url.searchParams.get("sourceId");
    const search = url.searchParams.get("search")?.trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);

    const where: Record<string, unknown> = {};
    if (category && CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      where.category = category;
    }
    if (level && LEVELS.includes(level as (typeof LEVELS)[number])) {
      where.level = level;
    }
    if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
      where.status = status;
    }
    if (eventKey) where.eventKey = eventKey;
    if (sourceType) where.sourceType = sourceType;
    if (sourceId) where.sourceId = sourceId;
    if (search) {
      where.OR = [
        { eventLabel: { contains: search, mode: "insensitive" } },
        { errorMessage: { contains: search, mode: "insensitive" } },
        { sourceId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      db.opsEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          createdAt: true,
          level: true,
          category: true,
          status: true,
          eventKey: true,
          eventLabel: true,
          sourceType: true,
          sourceId: true,
          route: true,
          method: true,
          durationMs: true,
          errorMessage: true,
        },
      }),
      db.opsEvent.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        level: e.level,
        category: e.category,
        status: e.status,
        eventKey: e.eventKey,
        eventLabel: e.eventLabel ?? null,
        sourceType: e.sourceType ?? null,
        sourceId: e.sourceId ?? null,
        route: e.route ?? null,
        method: e.method ?? null,
        durationMs: e.durationMs ?? null,
        errorMessage: e.errorMessage ?? null,
      })),
      total,
      hasMore: total > limit,
    });
  });
}
