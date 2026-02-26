/**
 * PATCH /api/next-actions/[id] — Mark done or dismiss.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { completeNextAction, dismissNextAction } from "@/lib/next-actions/service";

export const dynamic = "force-dynamic";

const VALID_ACTIONS = ["done", "dismiss"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/next-actions/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    if (!id) return jsonError("Missing action id", 400);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object") {
      return jsonError("Body must be an object", 400);
    }

    const action = (body as Record<string, unknown>).action;
    if (typeof action !== "string" || !VALID_ACTIONS.includes(action)) {
      return jsonError(`action must be one of: ${VALID_ACTIONS.join(", ")}`, 400);
    }

    try {
      if (action === "done") {
        await completeNextAction(id);
        return NextResponse.json({ ok: true, action: "done" });
      }
      if (action === "dismiss") {
        await dismissNextAction(id);
        return NextResponse.json({ ok: true, action: "dismiss" });
      }
      return jsonError("Invalid action", 400);
    } catch (err) {
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
