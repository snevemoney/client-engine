/**
 * Phase 4.3: NBA preference API.
 * GET /api/next-actions/preferences?entityType=...&entityId=...
 * POST /api/next-actions/preferences — create/update preference
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

export const dynamic = "force-dynamic";

const DURATION_DAYS: Record<string, number> = { "7d": 7, "30d": 30 };

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/next-actions/preferences", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const entityType = request.nextUrl.searchParams.get("entityType");
    const entityId = request.nextUrl.searchParams.get("entityId");
    if (!entityType || !entityId) {
      return jsonError("entityType and entityId required", 400);
    }

    const now = new Date();
    const rows = await db.nextActionPreference.findMany({
      where: {
        entityType,
        entityId,
        status: "active",
        OR: [{ suppressedUntil: null }, { suppressedUntil: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        ruleKey: r.ruleKey,
        dedupeKey: r.dedupeKey,
        status: r.status,
        suppressedUntil: r.suppressedUntil?.toISOString() ?? null,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return withRouteTiming("POST /api/next-actions/preferences", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

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
    const entityType = typeof b.entityType === "string" ? b.entityType : null;
    const entityId = typeof b.entityId === "string" ? b.entityId : null;
    const ruleKey = b.ruleKey != null ? (typeof b.ruleKey === "string" ? b.ruleKey : null) : null;
    const dedupeKey = b.dedupeKey != null ? (typeof b.dedupeKey === "string" ? b.dedupeKey : null) : null;
    const duration = b.duration != null && typeof b.duration === "string" ? b.duration : "30d";
    const reason = b.reason != null ? String(b.reason) : null;

    if (!entityType || !entityId) {
      return jsonError("entityType and entityId required", 400);
    }
    if (!ruleKey && !dedupeKey) {
      return jsonError("ruleKey or dedupeKey required", 400);
    }

    const days = DURATION_DAYS[duration] ?? 30;
    const suppressedUntil = new Date();
    suppressedUntil.setDate(suppressedUntil.getDate() + days);

    const existing = await db.nextActionPreference.findFirst({
      where: {
        entityType,
        entityId,
        ...(ruleKey ? { ruleKey } : dedupeKey ? { dedupeKey } : {}),
      },
    });

    let pref;
    if (existing) {
      pref = await db.nextActionPreference.update({
        where: { id: existing.id },
        data: {
          status: "active",
          suppressedUntil,
          reason,
          ...(ruleKey ? { ruleKey } : {}),
          ...(dedupeKey ? { dedupeKey } : {}),
        },
      });
    } else {
      pref = await db.nextActionPreference.create({
        data: {
          entityType,
          entityId,
          ruleKey: ruleKey ?? undefined,
          dedupeKey: dedupeKey ?? undefined,
          status: "active",
          suppressedUntil,
          reason,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      preference: {
        id: pref.id,
        entityType: pref.entityType,
        entityId: pref.entityId,
        ruleKey: pref.ruleKey,
        dedupeKey: pref.dedupeKey,
        status: pref.status,
        suppressedUntil: pref.suppressedUntil?.toISOString() ?? null,
        reason: pref.reason,
        createdAt: pref.createdAt.toISOString(),
      },
    });
  });
}
