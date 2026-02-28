/**
 * Phase 6.3.1: POST /api/internal/growth/followups/schedule
 * Sets nextFollowUpAt via FollowUpSchedule, updates Deal.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

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

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/growth/followups/schedule", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const rateErr = rateLimitMutate(request, userId);
    if (rateErr) return rateErr;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object") return jsonError("Body must be an object", 400);

    const b = body as Record<string, unknown>;
    const dealId = typeof b.dealId === "string" ? b.dealId : null;
    const nextFollowUpAtRaw = b.nextFollowUpAt;
    const cadenceDays = typeof b.cadenceDays === "number" ? b.cadenceDays : 3;

    if (!dealId || nextFollowUpAtRaw == null) return jsonError("dealId and nextFollowUpAt required", 400);

    const nextFollowUpAt =
      typeof nextFollowUpAtRaw === "string"
        ? new Date(nextFollowUpAtRaw)
        : nextFollowUpAtRaw instanceof Date
          ? nextFollowUpAtRaw
          : null;

    if (!nextFollowUpAt || isNaN(nextFollowUpAt.getTime())) return jsonError("Invalid nextFollowUpAt", 400);

    try {
      const deal = await db.deal.findFirst({
        where: { id: dealId, ownerUserId: userId },
      });

      if (!deal) return jsonError("Deal not found", 404);

      const existing = await db.followUpSchedule.findFirst({
        where: { dealId, status: "active" },
      });

      if (existing) {
        await db.followUpSchedule.update({
          where: { id: existing.id },
          data: { nextFollowUpAt, cadenceDays },
        });
      } else {
        await db.followUpSchedule.create({
          data: {
            dealId,
            nextFollowUpAt,
            cadenceDays,
            status: "active",
          },
        });
      }

      await db.deal.update({
        where: { id: dealId },
        data: { nextFollowUpAt },
      });

      await db.outreachEvent.create({
        data: {
          ownerUserId: userId,
          dealId,
          channel: "other",
          type: "followup_scheduled",
          occurredAt: new Date(),
          metaJson: { nextFollowUpAt: nextFollowUpAt.toISOString(), cadenceDays },
        },
      });

      return NextResponse.json({
        nextFollowUpAt: nextFollowUpAt.toISOString(),
        cadenceDays,
      });
    } catch (err) {
      console.error("[growth/followups/schedule]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
