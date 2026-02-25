/**
 * GET /api/internal/scores/latest — Latest score snapshot (auth required).
 * Phase 3.1: Score Engine.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/scores/latest", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(request.url);
      const entityType = searchParams.get("entityType");
      const entityId = searchParams.get("entityId");

      if (!entityType || !entityId) {
        return jsonError("entityType and entityId required", 400);
      }

      const [latest, previous, events] = await Promise.all([
      db.scoreSnapshot.findFirst({
        where: { entityType, entityId },
        orderBy: { computedAt: "desc" },
      }),
      db.scoreSnapshot.findMany({
        where: { entityType, entityId },
        orderBy: { computedAt: "desc" },
        skip: 1,
        take: 1,
      }),
      db.scoreEvent.findMany({
        where: { entityType, entityId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      latest: latest
        ? {
            id: latest.id,
            score: latest.score,
            band: latest.band,
            delta: latest.delta,
            factorsJson: latest.factorsJson,
            reasonsJson: latest.reasonsJson,
            computedAt: latest.computedAt.toISOString(),
          }
        : null,
      previous: previous[0]
        ? {
            id: previous[0].id,
            score: previous[0].score,
            band: previous[0].band,
            computedAt: previous[0].computedAt.toISOString(),
          }
        : null,
      recentEvents: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        fromScore: e.fromScore,
        toScore: e.toScore,
        delta: e.delta,
        fromBand: e.fromBand,
        toBand: e.toBand,
        createdAt: e.createdAt.toISOString(),
      })),
    });
    } catch (err) {
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
