/**
 * GET /api/next-actions/[id]/template — Template/playbook for a Next Action.
 * Phase 4.4.1: Returns template by templateKey or createdByRule fallback.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { getTemplateOrNull } from "@/lib/next-actions/templates";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/next-actions/[id]/template", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Missing action id", 400);

    try {
      const nba = await db.nextBestAction.findUnique({
        where: { id },
        select: { id: true, templateKey: true, createdByRule: true },
      });

      if (!nba) return jsonError("Next action not found", 404);

      const templateKey = nba.templateKey ?? nba.createdByRule ?? null;
      const template = getTemplateOrNull(templateKey);

      return NextResponse.json({
        nextActionId: nba.id,
        template,
      });
    } catch (err) {
      console.error("[next-actions/template]", err);
      return jsonError(sanitizeErrorMessage(err) ?? "Failed to load template", 500);
    }
  });
}
