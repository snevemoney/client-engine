/**
 * PATCH /api/automation-suggestions/[id] — Update status (accepted, rejected, expired).
 */
import { NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/automation-suggestions/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Missing id", 400);

    try {
      const body = await req.json().catch(() => ({}));
      const status = body.status ? String(body.status).toLowerCase() : null;

      if (!status || !["accepted", "rejected", "expired"].includes(status)) {
        return jsonError("Invalid status", 400);
      }

      const suggestion = await db.automationSuggestion.update({
        where: { id },
        data: { status, resolvedAt: new Date() },
      });

      return NextResponse.json({
        id: suggestion.id,
        status: suggestion.status,
        resolvedAt: suggestion.resolvedAt?.toISOString(),
      });
    } catch (err) {
      console.error("[automation-suggestions PATCH]", err);
      return jsonError("Failed to update suggestion", 500);
    }
  });
}
