/**
 * Phase 7.2: POST /api/internal/memory/apply — Apply policy suggestion (e.g. 30d suppression).
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";
import { db } from "@/lib/db";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/internal/memory/apply", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const userId = session.user?.id;
    if (!userId) return jsonError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (!body || typeof body !== "object") {
      return jsonError("Body must be an object", 400);
    }

    const b = body as Record<string, unknown>;
    const type = b.type;
    const ruleKey = typeof b.ruleKey === "string" ? b.ruleKey : null;

    if (type !== "suppression_30d" || !ruleKey) {
      return jsonError("Body must include { type: 'suppression_30d', ruleKey }", 400);
    }

    const entityType = "command_center";
    const entityId = "command_center";
    const suppressedUntil = new Date();
    suppressedUntil.setDate(suppressedUntil.getDate() + 30);

    try {
      const existing = await db.nextActionPreference.findFirst({
        where: { entityType, entityId, ruleKey },
      });

      const pref = existing
        ? await db.nextActionPreference.update({
            where: { id: existing.id },
            data: { status: "active", suppressedUntil, reason: "Memory policy: earned suppression" },
          })
        : await db.nextActionPreference.create({
            data: {
              entityType,
              entityId,
              ruleKey,
              status: "active",
              suppressedUntil,
              reason: "Memory policy: earned suppression",
            },
          });

      logOpsEventSafe({
        category: "system",
        eventKey: "memory.policy.applied",
        sourceType: "user",
        sourceId: userId,
        meta: sanitizeMeta({ type, ruleKey, preferenceId: pref.id }),
      });

      return NextResponse.json({
        ok: true,
        preference: {
          id: pref.id,
          ruleKey: pref.ruleKey,
          suppressedUntil: pref.suppressedUntil?.toISOString() ?? null,
        },
      });
    } catch (err) {
      console.error("[memory/apply]", err);
      return jsonError(sanitizeErrorMessage(err), 500);
    }
  });
}
