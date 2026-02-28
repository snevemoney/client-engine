/**
 * Phase 6.3.1: POST /api/internal/growth/outreach/draft
 * Creates draft record, returns subject/body + placeholders.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getRequestClientKey, rateLimitByKey } from "@/lib/http/rate-limit";
import { getTemplate, renderTemplate } from "@/lib/growth/templates";
import { OutreachChannel } from "@prisma/client";

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
  return withRouteTiming("POST /api/internal/growth/outreach/draft", async () => {
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
    const channel =
      b.channel && CHANNELS.includes(b.channel as OutreachChannel)
        ? (b.channel as OutreachChannel)
        : "dm";

    if (!dealId || !templateKey) return jsonError("dealId and templateKey required", 400);

    const template = getTemplate(templateKey);
    if (!template) return jsonError("Unknown templateKey", 400);

    try {
      const deal = await db.deal.findFirst({
        where: { id: dealId, ownerUserId: userId },
        include: { prospect: true },
      });

      if (!deal) return jsonError("Deal not found", 404);

      const vars: Record<string, string | number | undefined> = {
        name: deal.prospect.name,
        handle: deal.prospect.handle ?? undefined,
        niche: deal.prospect.niche ?? undefined,
        followers: deal.prospect.followers ?? undefined,
        currentWebPresence: deal.prospect.currentWebPresence ?? undefined,
      };

      const content = renderTemplate(template, vars);

      const draft = await db.outreachMessage.create({
        data: {
          dealId,
          channel,
          templateKey,
          content,
          status: "draft",
        },
      });

      const placeholders = Object.keys(vars);

      return NextResponse.json({
        draftId: draft.id,
        content,
        subject: template.subject ?? null,
        placeholders,
        nextFollowUpDays: template.nextFollowUpDays,
      });
    } catch (err) {
      console.error("[growth/outreach/draft]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
