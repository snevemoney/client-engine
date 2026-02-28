/**
 * Phase 6.3: GET/PATCH /api/internal/growth/deals/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { DealStage, DealPriority } from "@prisma/client";

export const dynamic = "force-dynamic";

const STAGES = Object.values(DealStage);
const PRIORITIES = Object.values(DealPriority);

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/internal/growth/deals/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Deal id required", 400);

    try {
      const deal = await db.deal.findFirst({
        where: { id, ownerUserId: userId },
        include: {
          prospect: true,
          outreachMessages: { orderBy: { createdAt: "desc" } },
          events: { orderBy: { occurredAt: "desc" } },
        },
      });

      if (!deal) return jsonError("Deal not found", 404);
      return NextResponse.json(deal);
    } catch (err) {
      console.error("[growth/deals/[id]]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/internal/growth/deals/[id]", async () => {
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
    const data: Record<string, unknown> = {};

    if (b.stage && STAGES.includes(b.stage as DealStage)) data.stage = b.stage;
    if (b.priority && PRIORITIES.includes(b.priority as DealPriority)) data.priority = b.priority;
    if (b.valueCad != null) data.valueCad = typeof b.valueCad === "number" ? b.valueCad : parseInt(String(b.valueCad), 10);
    if (b.nextFollowUpAt != null) data.nextFollowUpAt = b.nextFollowUpAt ? new Date(b.nextFollowUpAt as string) : null;
    if (b.lastContactedAt != null) data.lastContactedAt = b.lastContactedAt ? new Date(b.lastContactedAt as string) : null;

    if (Object.keys(data).length === 0) return jsonError("No updatable fields provided", 400);

    try {
      const deal = await db.deal.findFirst({
        where: { id, ownerUserId: userId },
      });
      if (!deal) return jsonError("Deal not found", 404);

      const updated = await db.deal.update({
        where: { id },
        data,
      });

      return NextResponse.json(updated);
    } catch (err) {
      console.error("[growth/deals/[id]]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}