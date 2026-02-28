/**
 * Phase 6.3.1: POST /api/internal/growth/outreach/send
 * Logs OutreachEvent.sent; optional provider stub. Updates Deal, creates FollowUpSchedule.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { getTemplate } from "@/lib/growth/templates";
import { OutreachChannel } from "@prisma/client";
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

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/growth/outreach/send", async () => {
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
    const templateKey = typeof b.templateKey === "string" ? b.templateKey : null;
    const content = typeof b.content === "string" ? b.content.trim() : null;
    const draftId = typeof b.draftId === "string" ? b.draftId : null;
    const channel =
      b.channel && CHANNELS.includes(b.channel as OutreachChannel)
        ? (b.channel as OutreachChannel)
        : "dm";

    if (!dealId || !templateKey || !content) return jsonError("dealId, templateKey, and content required", 400);

    const template = getTemplate(templateKey);
    if (!template) return jsonError("Unknown templateKey", 400);

    try {
      const deal = await db.deal.findFirst({
        where: { id: dealId, ownerUserId: userId },
        include: { prospect: true },
      });

      if (!deal) return jsonError("Deal not found", 404);

      const now = new Date();
      const nextFollowUpAt = new Date(now);
      nextFollowUpAt.setDate(nextFollowUpAt.getDate() + template.nextFollowUpDays);

      const [outreachEvent, message] = await db.$transaction(async (tx) => {
        const evt = await tx.outreachEvent.create({
          data: {
            ownerUserId: userId,
            dealId,
            channel,
            type: "sent",
            occurredAt: now,
            metaJson: {
              templateKey,
              subject: template.subject,
              draftId: draftId ?? undefined,
            },
          },
        });

        let msg;
        if (draftId) {
          const draft = await tx.outreachMessage.findFirst({
            where: { id: draftId, dealId },
          });
          if (draft) {
            msg = await tx.outreachMessage.update({
              where: { id: draftId },
              data: { content, status: "sent", sentAt: now },
            });
          } else {
            msg = await tx.outreachMessage.create({
              data: {
                dealId,
                channel,
                templateKey,
                content,
                status: "sent",
                sentAt: now,
              },
            });
          }
        } else {
          msg = await tx.outreachMessage.create({
            data: {
              dealId,
              channel,
              templateKey,
              content,
              status: "sent",
              sentAt: now,
            },
          });
        }

        await tx.deal.update({
          where: { id: dealId },
          data: {
            stage: "contacted",
            lastContactedAt: now,
            nextFollowUpAt,
          },
        });

        const existing = await tx.followUpSchedule.findFirst({
          where: { dealId, status: "active" },
        });
        if (existing) {
          await tx.followUpSchedule.update({
            where: { id: existing.id },
            data: { nextFollowUpAt, cadenceDays: template.nextFollowUpDays },
          });
        } else {
          await tx.followUpSchedule.create({
            data: {
              dealId,
              nextFollowUpAt,
              cadenceDays: template.nextFollowUpDays,
              status: "active",
            },
          });
        }

        return [evt, msg];
      });

      ingestFromGrowthOutreach(message.id, userId, "sent").catch(() => {});

      return NextResponse.json({
        outreachEventId: outreachEvent.id,
        messageId: message.id,
        nextFollowUpAt: nextFollowUpAt.toISOString(),
      });
    } catch (err) {
      console.error("[growth/outreach/send]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
