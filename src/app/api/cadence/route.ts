/**
 * GET /api/cadence?sourceType=lead|delivery_project|project&sourceId=xxx
 * List cadences for a source. Auth: session.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_SOURCE_TYPES = new Set(["lead", "delivery_project", "project"]);

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/cadence", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const sourceType = searchParams.get("sourceType");
    const sourceId = searchParams.get("sourceId");

    if (!sourceType || !sourceId) {
      return jsonError("sourceType and sourceId required", 400);
    }
    if (!VALID_SOURCE_TYPES.has(sourceType)) {
      return jsonError("Invalid sourceType", 400);
    }

    const cadences = await db.cadence.findMany({
      where: { sourceType, sourceId },
      orderBy: { dueAt: "asc" },
    });

    return NextResponse.json(
      cadences.map((c) => ({
        id: c.id,
        sourceType: c.sourceType,
        sourceId: c.sourceId,
        trigger: c.trigger,
        dueAt: c.dueAt.toISOString(),
        completedAt: c.completedAt?.toISOString() ?? null,
        snoozedUntil: c.snoozedUntil?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  });
}
