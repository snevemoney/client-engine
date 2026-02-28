/**
 * Phase 6.3: POST /api/internal/growth/deals/[id]/events
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { DealEventType, DealStage } from "@prisma/client";
import { ingestFromGrowthStageChange } from "@/lib/memory/growth-ingest";

export const dynamic = "force-dynamic";

const EVENT_TYPES = Object.values(DealEventType);

function rateLimitMutate(request: NextRequest, userId: string) {
  const clientKey = getRequestClientKey(request, userId);
  const rl = rateLimitByKey({ key: `rl:growth:${clientKey}`, windowMs: 60_000, max: 20 });
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return jsonError("Rate limit exceeded", 429, undefined, {
      headers: { "Retry-After": String(retryAfter) },
      bodyExtra: { retryAfterSeconds: retryAfter },
    });
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/internal/growth/deals/[id]/events", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const rateErr = rateLimitMutate(request, userId);
    if (rateErr) return rateErr;

    const { id } = await params;
    if (!id) return jsonError("Deal id required", 400);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object") return jsonError("Body must be an object", 400);

    const b = body as Record<string, unknown>;
    const type = b.type && EVENT_TYPES.includes(b.type as DealEventType) ? (b.type as DealEventType) : null;
    const summary = typeof b.summary === "string" ? b.summary.trim() : null;

    if (!type || !summary) return jsonError("type and summary required", 400);

    const metaJson = b.metaJson && typeof b.metaJson === "object" ? b.metaJson : {};

    try {
      const deal = await db.deal.findFirst({
        where: { id, ownerUserId: userId },
      });

      if (!deal) return jsonError("Deal not found", 404);

      const now = new Date();
      const occurredAt = b.occurredAt ? new Date(b.occurredAt as string) : now;

      let newStage: DealStage | undefined;

      if (type === "call") {
        const meta = metaJson as Record<string, unknown>;
        if (meta?.booked) newStage = "call_scheduled";
      } else if (type === "payment") {
        newStage = "won";
      } else if (type === "status_change") {
        const meta = metaJson as Record<string, unknown>;
        if (meta?.stage && ["replied", "call_scheduled", "proposal_sent", "won", "lost"].includes(meta.stage as string)) {
          newStage = meta.stage as DealStage;
        }
      }

      const event = await db.dealEvent.create({
        data: {
          dealId: id,
          type,
          summary,
          metaJson,
          occurredAt,
        },
      });

      if (newStage) {
        await db.deal.update({
          where: { id },
          data: { stage: newStage },
        });
        ingestFromGrowthStageChange(id, userId, deal.stage, newStage).catch(() => {});
      }

      return NextResponse.json({
        event: { id: event.id, type: event.type, summary: event.summary, occurredAt: event.occurredAt },
        ...(newStage ? { deal: { stage: newStage } } : {}),
      });
    } catch (err) {
      console.error("[growth/events]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
