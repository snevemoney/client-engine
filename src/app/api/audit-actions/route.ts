/**
 * GET /api/audit-actions — List audit actions with filters
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/audit-actions", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const sourceType = url.searchParams.get("sourceType");
    const sourceId = url.searchParams.get("sourceId");
    const actionKey = url.searchParams.get("actionKey");
    const search = url.searchParams.get("search")?.trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 200);

    const where: Record<string, unknown> = {};
    if (sourceType) where.sourceType = sourceType;
    if (sourceId) where.sourceId = sourceId;
    if (actionKey) where.actionKey = actionKey;
    if (search) {
      where.OR = [
        { sourceLabel: { contains: search, mode: "insensitive" } },
        { note: { contains: search, mode: "insensitive" } },
        { actionLabel: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await db.auditAction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      items: items.map((a) => ({
        id: a.id,
        createdAt: a.createdAt.toISOString(),
        actionKey: a.actionKey,
        actionLabel: a.actionLabel,
        sourceType: a.sourceType,
        sourceId: a.sourceId,
        sourceLabel: a.sourceLabel ?? null,
        beforeJson: a.beforeJson,
        afterJson: a.afterJson,
        note: a.note ?? null,
        actorId: a.actorId ?? null,
        actorLabel: a.actorLabel ?? null,
        metaJson: a.metaJson,
      })),
    });
  });
}
