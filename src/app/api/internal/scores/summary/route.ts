/**
 * GET /api/internal/scores/summary — Aggregated score data for dashboard UI (auth required).
 * Phase 3.2: Scoreboard UI. Single fetch for latest, previous, events, parsed reasons, factor summary.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type FactorJson = { key?: string; label?: string; weight?: number; normalizedValue?: number; impact?: number; reason?: string };
type ReasonJson = { label?: string; impact?: number; direction?: string };

function parseFactors(factorsJson: unknown): Array<{
  key: string;
  label: string;
  weight: number;
  normalizedValue: number;
  impact: number;
  reason?: string;
}> {
  if (!Array.isArray(factorsJson)) return [];
  return factorsJson
    .filter((f): f is FactorJson => f != null && typeof f === "object")
    .map((f) => ({
      key: String(f.key ?? ""),
      label: String(f.label ?? f.key ?? "—"),
      weight: Number(f.weight) ?? 0,
      normalizedValue: Number(f.normalizedValue) ?? 0,
      impact: Number(f.impact) ?? 0,
      reason: typeof f.reason === "string" ? f.reason : undefined,
    }));
}

function parseReasons(reasonsJson: unknown): Array<{ label: string; impact: number; direction: string }> {
  if (!Array.isArray(reasonsJson)) return [];
  return reasonsJson
    .filter((r): r is ReasonJson => r != null && typeof r === "object")
    .map((r) => ({
      label: String(r.label ?? "—"),
      impact: Number(r.impact) ?? 0,
      direction: String(r.direction ?? "neutral"),
    }))
    .sort((a, b) => a.impact - b.impact); // ascending: most negative first (negative impact = lower score)
}

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/scores/summary", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(request.url);
      const entityType = searchParams.get("entityType") ?? "command_center";
      const entityId = searchParams.get("entityId") ?? "command_center";

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
          take: 10,
        }),
      ]);

      const prevSnapshot = previous[0] ?? null;
      const latestData = latest
      ? {
          id: latest.id,
          score: latest.score,
          band: latest.band,
          delta: latest.delta,
          computedAt: latest.computedAt.toISOString(),
          topReasons: parseReasons(latest.reasonsJson),
          factorSummary: parseFactors(latest.factorsJson),
        }
      : null;

      const previousFactorSummary = prevSnapshot ? parseFactors(prevSnapshot.factorsJson) : null;

      return NextResponse.json({
      latest: latestData,
      previous: prevSnapshot
        ? {
            id: prevSnapshot.id,
            score: prevSnapshot.score,
            band: prevSnapshot.band,
            computedAt: prevSnapshot.computedAt.toISOString(),
          }
        : null,
      previousFactorSummary,
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
