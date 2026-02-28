/**
 * Phase 4.3: NBA preference API.
 * GET /api/next-actions/preferences/[id] — get one
 * PATCH /api/next-actions/preferences/[id] — set active (re-enable)
 * DELETE /api/next-actions/preferences/[id]
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("GET /api/next-actions/preferences/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const pref = await db.nextActionPreference.findUnique({ where: { id } });
    if (!pref) return jsonError("Preference not found", 404);

    return NextResponse.json({
      id: pref.id,
      entityType: pref.entityType,
      entityId: pref.entityId,
      ruleKey: pref.ruleKey,
      dedupeKey: pref.dedupeKey,
      status: pref.status,
      suppressedUntil: pref.suppressedUntil?.toISOString() ?? null,
      reason: pref.reason,
      createdAt: pref.createdAt.toISOString(),
      updatedAt: pref.updatedAt.toISOString(),
    });
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("PATCH /api/next-actions/preferences/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const pref = await db.nextActionPreference.findUnique({ where: { id } });
    if (!pref) return jsonError("Preference not found", 404);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const b = (body as Record<string, unknown>) ?? {};
    const status = b.status === "suppressed" ? "suppressed" : null;

    if (status === "suppressed") {
      // Re-enable: stop suppressing so the NBA shows again
      await db.nextActionPreference.update({
        where: { id },
        data: { status: "suppressed", suppressedUntil: null },
      });
      return NextResponse.json({ ok: true, action: "re-enabled" });
    }

    return jsonError("Body must include status: suppressed to re-enable", 400);
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("DELETE /api/next-actions/preferences/[id]", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { id } = await params;
    try {
      await db.nextActionPreference.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return jsonError(sanitizeErrorMessage(err) ?? "Failed to delete", 500);
    }
  });
}
