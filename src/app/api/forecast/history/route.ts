/**
 * GET /api/forecast/history — Snapshot history for a given forecast metric.
 * Query: periodType, forecastKey, limit (default 8)
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withRouteTiming("GET /api/forecast/history", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    try {
      const { searchParams } = new URL(req.url);
      const periodType = (searchParams.get("periodType") ?? "weekly") as "weekly" | "monthly";
      const forecastKey = searchParams.get("forecastKey") ?? "delivered_value";
      const limit = Math.min(24, Math.max(1, parseInt(searchParams.get("limit") ?? "8", 10) || 8));

      const records = await db.forecastSnapshot.findMany({
        where: { periodType, forecastKey },
        orderBy: { periodStart: "desc" },
        take: limit,
      });

      const items = records.map((r) => ({
        periodStart: r.periodStart.toISOString().slice(0, 10),
        forecastKey: r.forecastKey,
        forecastLabel: r.forecastLabel,
        forecastValue: r.forecastValue,
        confidence: r.confidence ?? null,
      }));

      return NextResponse.json({
        periodType,
        forecastKey,
        items: items.reverse(),
      });
    } catch (err) {
      console.error("[forecast/history]", err);
      return jsonError("Failed to load history", 500);
    }
  });
}
