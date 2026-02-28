/**
 * Phase 6.3: POST /api/internal/growth/deals/[id]/outreach/preview
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { getTemplate, renderTemplate } from "@/lib/growth/templates";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/internal/growth/deals/[id]/outreach/preview", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Deal id required", 400);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object") return jsonError("Body must be an object", 400);

    const templateKey = (body as Record<string, unknown>).templateKey;
    if (typeof templateKey !== "string") return jsonError("templateKey required", 400);

    const template = getTemplate(templateKey);
    if (!template) return jsonError("Unknown templateKey", 400);

    try {
      const deal = await db.deal.findFirst({
        where: { id, ownerUserId: userId },
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

      const now = new Date();
      const nextFollowUpAt = new Date(now);
      nextFollowUpAt.setDate(nextFollowUpAt.getDate() + template.nextFollowUpDays);

      return NextResponse.json({
        content,
        followUpSuggestion: {
          nextFollowUpAt: nextFollowUpAt.toISOString(),
          reason: `Default ${template.nextFollowUpDays}d follow-up`,
        },
      });
    } catch (err) {
      console.error("[growth/outreach/preview]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
