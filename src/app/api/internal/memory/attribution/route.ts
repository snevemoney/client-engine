/**
 * Phase 7.3: GET /api/internal/memory/attribution — List attributions for debugging.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/internal/memory/attribution", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const range = request.nextUrl.searchParams.get("range") ?? "7d";
    const days = range === "30d" ? 30 : 7;
    const since = daysAgo(days);
    const ruleKey = request.nextUrl.searchParams.get("ruleKey")?.trim() || undefined;

    try {
      const attributions = await db.operatorAttribution.findMany({
        where: {
          actorUserId: userId,
          occurredAt: { gte: since, lt: new Date() },
          ...(ruleKey ? { ruleKey } : {}),
        },
        orderBy: { occurredAt: "desc" },
        take: 50,
        select: {
          id: true,
          sourceType: true,
          ruleKey: true,
          actionKey: true,
          entityType: true,
          entityId: true,
          occurredAt: true,
          deltaJson: true,
        },
      });

      return NextResponse.json({
        items: attributions.map((a) => ({
          id: a.id,
          sourceType: a.sourceType,
          ruleKey: a.ruleKey,
          actionKey: a.actionKey,
          entityType: a.entityType,
          entityId: a.entityId,
          occurredAt: a.occurredAt.toISOString(),
          delta: a.deltaJson,
        })),
        range,
      });
    } catch (err) {
      console.error("[memory/attribution]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
