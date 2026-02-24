/**
 * GET /api/signals/items — List signal items with filters
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/signals/items", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const sourceId = searchParams.get("sourceId") || undefined;
    const status = searchParams.get("status") || undefined;
    const minScore = searchParams.get("minScore");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

    const where: { sourceId?: string; status?: string; score?: { gte: number } } = {};
    if (sourceId) where.sourceId = sourceId;
    if (status) where.status = status;
    if (minScore !== null && minScore !== "") {
      const n = parseInt(minScore, 10);
      if (!isNaN(n)) where.score = { gte: n };
    }

    const items = await db.signalItem.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: limit,
      include: {
        source: { select: { id: true, name: true, mode: true } },
      },
    });

    return NextResponse.json({
      items: items.map((i) => ({
        id: i.id,
        sourceId: i.sourceId,
        sourceName: i.source.name,
        title: i.title,
        url: i.url,
        publishedAt: i.publishedAt?.toISOString() ?? null,
        summary: i.summary,
        score: i.score,
        tags: i.tags,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  });
}
