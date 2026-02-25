/**
 * Phase 3.4: Unit tests for score alerts preferences endpoints.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  getScoreAlertsPreferences,
  updateScoreAlertsPreferences,
  SCORE_ALERTS_KEY,
} from "@/lib/scores/alerts-preferences";

describe("score alerts preferences", () => {
  beforeEach(async () => {
    await db.internalSetting.deleteMany({ where: { key: SCORE_ALERTS_KEY } });
  });

  it("GET returns defaults when no config exists", async () => {
    const prefs = await getScoreAlertsPreferences();
    expect(prefs.enabled).toBe(true);
    expect(prefs.events.threshold_breach).toBe(true);
    expect(prefs.events.sharp_drop).toBe(true);
    expect(prefs.events.recovery).toBe(true);
    expect(prefs.sharpDropMinDelta).toBe(15);
    expect(prefs.cooldownMinutes).toBe(60);
    expect(prefs.updatedAt).toBeDefined();
  });

  it("PUT creates and persists values", async () => {
    const updated = await updateScoreAlertsPreferences({
      enabled: false,
      events: { threshold_breach: false, sharp_drop: true, recovery: false },
    });
    expect(updated.enabled).toBe(false);
    expect(updated.events.threshold_breach).toBe(false);
    expect(updated.events.sharp_drop).toBe(true);
    expect(updated.events.recovery).toBe(false);

    const loaded = await getScoreAlertsPreferences();
    expect(loaded.enabled).toBe(false);
    expect(loaded.events.threshold_breach).toBe(false);
    expect(loaded.events.recovery).toBe(false);
  });

  it("PUT rejects invalid cooldownMinutes", async () => {
    const { updateScoreAlertsPreferences } = await import("@/lib/scores/alerts-preferences");
    await expect(updateScoreAlertsPreferences({ cooldownMinutes: -1 })).rejects.toThrow(
      "cooldownMinutes must be 0-1440"
    );
    await expect(updateScoreAlertsPreferences({ cooldownMinutes: 1500 })).rejects.toThrow(
      "cooldownMinutes must be 0-1440"
    );
  });

  it("PUT merges partial updates", async () => {
    await updateScoreAlertsPreferences({ enabled: false });
    const updated = await updateScoreAlertsPreferences({
      events: { recovery: false },
    });
    expect(updated.enabled).toBe(false);
    expect(updated.events.recovery).toBe(false);
  });

  it("PUT rejects invalid sharpDropMinDelta (Phase 3.6.2 adversarial)", async () => {
    await expect(updateScoreAlertsPreferences({ sharpDropMinDelta: 0 })).rejects.toThrow(
      "sharpDropMinDelta must be 1-100"
    );
    await expect(updateScoreAlertsPreferences({ sharpDropMinDelta: 200 })).rejects.toThrow(
      "sharpDropMinDelta must be 1-100"
    );
  });

  it("repeated saves: final value correct (Phase 3.6.2)", async () => {
    const { getScoreAlertsPreferences } = await import("@/lib/scores/alerts-preferences");
    await updateScoreAlertsPreferences({ cooldownMinutes: 60 });
    await updateScoreAlertsPreferences({ cooldownMinutes: 90 });
    await updateScoreAlertsPreferences({ cooldownMinutes: 120 });
    const final = await getScoreAlertsPreferences();
    expect(final.cooldownMinutes).toBe(120);
  });
});
