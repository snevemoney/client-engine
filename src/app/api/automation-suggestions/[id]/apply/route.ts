/**
 * POST /api/automation-suggestions/[id]/apply — Manually apply suggestion.
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { applyAutomationSuggestion } from "@/lib/automation-suggestions/apply";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/automation-suggestions/[id]/apply", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Missing id", 400);

    try {
      const suggestion = await db.automationSuggestion.findUnique({
        where: { id },
      });

      if (!suggestion) return jsonError("Suggestion not found", 404);
      if (suggestion.status !== "pending" && suggestion.status !== "accepted") {
        return jsonError("Suggestion cannot be applied", 400);
      }

      const result = await applyAutomationSuggestion({
        id: suggestion.id,
        type: suggestion.type,
        sourceType: suggestion.sourceType,
        sourceId: suggestion.sourceId,
        payloadJson: suggestion.payloadJson,
        actionUrl: suggestion.actionUrl,
      });

      if (result.success) {
        await db.automationSuggestion.update({
          where: { id },
          data: { status: "applied", resolvedAt: new Date() },
        });
      }

      return NextResponse.json({
        success: result.success,
        action: result.action,
        reminderId: result.reminderId,
        error: result.error,
        warning: result.warning,
      });
    } catch (err) {
      console.error("[automation-suggestions apply]", err);
      return jsonError("Failed to apply suggestion", 500);
    }
  });
}
