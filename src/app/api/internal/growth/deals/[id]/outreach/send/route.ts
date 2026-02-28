/**
 * Phase 6.3: POST /api/internal/growth/deals/[id]/outreach/send
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { OutreachChannel } from "@prisma/client";
import { getTemplate } from "@/lib/growth/templates";
import { ingestFromGrowthOutreach } from "@/lib/memory/growth-ingest";

export const dynamic = "force-dynamic";

const CHANNELS = Object.values(OutreachChannel);

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
  return withRouteTiming("POST /api/internal/growth/deals/[id]/outreach/send", async () => {
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
    const templateKey = typeof b.templateKey === "string" ? b.templateKey : null;
    const content = typeof b.content === "string" ? b.content.trim() : null;

    if (!templateKey || !content) return jsonError("templateKey and content required", 400);

    const template = getTemplate(templateKey);
    if (!template) return jsonError("Unknown templateKey", 400);

    const channel = (b.channel && CHANNELS.includes(b.channel as OutreachChannel)) ? (b.channel as OutreachChannel) : "dm";

    try {
      const deal = await db.deal.findFirst({
        where: { id, ownerUserId: userId },
        include: { prospect: true },
      });

      if (!deal) return jsonError("Deal not found", 404);

      const now = new Date();
      const nextFollowUpAt = new Date(now);
      nextFollowUpAt.setDate(nextFollowUpAt.getDate() + template.nextFollowUpDays);

      const message = await db.outreachMessage.create({
        data: {
          dealId: id,
          channel,
          templateKey,
          content,
          status: "sent",
          sentAt: now,
        },
      });

      await db.deal.update({
        where: { id },
        data: {
          stage: "contacted",
          lastContactedAt: now,
          nextFollowUpAt,
        },
      });

      ingestFromGrowthOutreach(message.id, userId, "sent").catch(() => {});

      return NextResponse.json({
        message: { id: message.id, status: message.status, sentAt: message.sentAt },
        deal: { stage: "contacted", nextFollowUpAt: nextFollowUpAt.toISOString() },
      });
    } catch (err) {
      console.error("[growth/outreach/send]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
