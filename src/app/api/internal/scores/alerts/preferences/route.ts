/**
 * GET/PUT /api/internal/scores/alerts/preferences — Score alerts preferences (auth required).
 * Phase 3.4.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import {
  getScoreAlertsPreferences,
  updateScoreAlertsPreferences,
  DEFAULT_PREFERENCES,
  type ScoreAlertsPreferences,
} from "@/lib/scores/alerts-preferences";

export const dynamic = "force-dynamic";

function parsePutBody(raw: unknown): Partial<ScoreAlertsPreferences> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<ScoreAlertsPreferences> = {};
  if (typeof o.enabled === "boolean") out.enabled = o.enabled;
  if (o.events != null && typeof o.events === "object") {
    const e = o.events as Record<string, boolean>;
    const events: Partial<ScoreAlertsPreferences["events"]> = {};
    if (typeof e.threshold_breach === "boolean") events.threshold_breach = e.threshold_breach;
    if (typeof e.sharp_drop === "boolean") events.sharp_drop = e.sharp_drop;
    if (typeof e.recovery === "boolean") events.recovery = e.recovery;
    if (Object.keys(events).length > 0) out.events = { ...DEFAULT_PREFERENCES.events, ...events };
  }
  if (typeof o.sharpDropMinDelta === "number") {
    out.sharpDropMinDelta = Math.max(1, Math.min(100, o.sharpDropMinDelta));
  }
  if (typeof o.cooldownMinutes === "number") {
    out.cooldownMinutes = o.cooldownMinutes;
  }
  return Object.keys(out).length > 0 ? out : null;
}


export async function GET() {
  return withRouteTiming("GET /api/internal/scores/alerts/preferences", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const prefs = await getScoreAlertsPreferences();
    return NextResponse.json(prefs);
  });
}

export async function PUT(request: NextRequest) {
  return withRouteTiming("PUT /api/internal/scores/alerts/preferences", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const partial = parsePutBody(body);
    if (!partial) {
      return jsonError("No valid fields to update", 400);
    }

    let prefs;
    try {
      prefs = await updateScoreAlertsPreferences(partial);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validation failed";
      return jsonError(msg, 400);
    }
    return NextResponse.json(prefs);
  });
}
