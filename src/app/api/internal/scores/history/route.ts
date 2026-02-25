/**
 * GET /api/internal/scores/history — Score timeline (auth required).
 * Phase 3.1: Score Engine.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseRange(range: string): { days: number } {
  if (range === "24h" || range === "1d") return { days: 1 };
  const m = range.match(/^(\d+)d$/);
  if (m) return { days: Math.min(90, Math.max(1, parseInt(m[1], 10))) };
  if (range === "7d") return { days: 7 };
  if (range === "30d") return { days: 30 };
  return { days: 7 };
}

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/scores/history", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(request.url);
      const entityType = searchParams.get("entityType");
      const entityId = searchParams.get("entityId");
      const range = searchParams.get("range") ?? "7d";

      if (!entityType || !entityId) {
        return jsonError("entityType and entityId required", 400);
      }

      const { days } = parseRange(range);
      const since = new Date();
      since.setDate(since.getDate() - days);

      const [snapshots, events] = await Promise.all([
        db.scoreSnapshot.findMany({
          where: { entityType, entityId, computedAt: { gte: since } },
          orderBy: { computedAt: "asc" },
        }),
        db.scoreEvent.findMany({
          where: { entityType, entityId, createdAt: { gte: since } },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      return NextResponse.json({
        timeline: snapshots.map((s) => ({
        id: s.id,
        score: s.score,
        band: s.band,
        delta: s.delta,
        computedAt: s.computedAt.toISOString(),
      })),
      events: events.map((e) => ({
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
