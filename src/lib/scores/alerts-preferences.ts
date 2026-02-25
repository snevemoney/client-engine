/**
 * Phase 3.4: Score alerts preferences — operator controls for notification emission.
 */

import { db } from "@/lib/db";

export const SCORE_ALERTS_KEY = "score_alerts_preferences";

export type ScoreAlertsPreferences = {
  enabled: boolean;
  events: {
    threshold_breach: boolean;
    sharp_drop: boolean;
    recovery: boolean;
  };
  sharpDropMinDelta: number;
  cooldownMinutes: number;
  updatedAt: string;
};

export const DEFAULT_PREFERENCES: ScoreAlertsPreferences = {
  enabled: true,
  events: {
    threshold_breach: true,
    sharp_drop: true,
    recovery: true,
  },
  sharpDropMinDelta: 15,
  cooldownMinutes: 60,
  updatedAt: new Date().toISOString(),
};

export type ShouldEmitResult = { emit: boolean; reason?: string };

/** Determine if a score event should emit a notification based on preferences. */
export function shouldEmitScoreNotification(
  eventType: "threshold_breach" | "sharp_drop" | "recovery",
  delta: number,
  prefs: ScoreAlertsPreferences | null
): ShouldEmitResult {
  const p = prefs ?? DEFAULT_PREFERENCES;

  if (!p.enabled) {
    return { emit: false, reason: "global_disabled" };
  }

  const eventEnabled = p.events[eventType];
  if (!eventEnabled) {
    return { emit: false, reason: "event_disabled" };
  }

  if (eventType === "sharp_drop") {
    const minDelta = p.sharpDropMinDelta ?? 15;
    if (Math.abs(delta) < minDelta) {
      return { emit: false, reason: "below_min_delta" };
    }
  }

  return { emit: true };
}

function parsePreferences(val: unknown): ScoreAlertsPreferences {
  if (!val || typeof val !== "object") return { ...DEFAULT_PREFERENCES, updatedAt: new Date().toISOString() };
  const o = val as Record<string, unknown>;
  const events = (o.events as Record<string, boolean>) ?? {};
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : DEFAULT_PREFERENCES.enabled,
    events: {
      threshold_breach: typeof events.threshold_breach === "boolean" ? events.threshold_breach : true,
      sharp_drop: typeof events.sharp_drop === "boolean" ? events.sharp_drop : true,
      recovery: typeof events.recovery === "boolean" ? events.recovery : true,
    },
    sharpDropMinDelta: typeof o.sharpDropMinDelta === "number" ? Math.max(1, Math.min(100, o.sharpDropMinDelta)) : 15,
    cooldownMinutes: typeof o.cooldownMinutes === "number" ? Math.max(0, Math.min(1440, o.cooldownMinutes)) : 60,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

/** Load preferences from DB. Returns defaults when missing. */
export async function getScoreAlertsPreferences(): Promise<ScoreAlertsPreferences> {
  const row = await db.internalSetting.findUnique({
    where: { key: SCORE_ALERTS_KEY },
  });
  const val = row?.valueJson;
  const parsed = parsePreferences(val);
  if (row?.updatedAt) {
    parsed.updatedAt = row.updatedAt.toISOString();
  }
  return parsed;
}

function validatePartial(partial: Partial<Omit<ScoreAlertsPreferences, "updatedAt">>): void {
  if (partial.cooldownMinutes !== undefined) {
    if (partial.cooldownMinutes < 0 || partial.cooldownMinutes > 1440) {
      throw new Error("cooldownMinutes must be 0-1440");
    }
  }
  if (partial.sharpDropMinDelta !== undefined) {
    if (partial.sharpDropMinDelta < 1 || partial.sharpDropMinDelta > 100) {
      throw new Error("sharpDropMinDelta must be 1-100");
    }
  }
}

/** Update preferences in DB. Merges with existing. */
export async function updateScoreAlertsPreferences(
  partial: Partial<Omit<ScoreAlertsPreferences, "updatedAt">>
): Promise<ScoreAlertsPreferences> {
  validatePartial(partial);
  const current = await getScoreAlertsPreferences();
  const merged: Omit<ScoreAlertsPreferences, "updatedAt"> = {
    enabled: partial.enabled ?? current.enabled,
    events: {
      threshold_breach: partial.events?.threshold_breach ?? current.events.threshold_breach,
      sharp_drop: partial.events?.sharp_drop ?? current.events.sharp_drop,
      recovery: partial.events?.recovery ?? current.events.recovery,
    },
    sharpDropMinDelta: partial.sharpDropMinDelta ?? current.sharpDropMinDelta,
    cooldownMinutes: partial.cooldownMinutes ?? current.cooldownMinutes,
  };
  const valueJson = { ...merged, updatedAt: new Date().toISOString() };
  await db.internalSetting.upsert({
    where: { key: SCORE_ALERTS_KEY },
    create: { key: SCORE_ALERTS_KEY, valueJson },
    update: { valueJson },
  });
  return getScoreAlertsPreferences();
}
