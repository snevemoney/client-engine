/**
 * Phase 3.4: Unit tests for score alerts preference evaluation.
 */
import { describe, it, expect } from "vitest";
import {
  shouldEmitScoreNotification,
  DEFAULT_PREFERENCES,
  type ScoreAlertsPreferences,
} from "./alerts-preferences";

describe("shouldEmitScoreNotification", () => {
  it("global disabled suppresses all", () => {
    const prefs: ScoreAlertsPreferences = {
      ...DEFAULT_PREFERENCES,
      enabled: false,
    };
    expect(shouldEmitScoreNotification("threshold_breach", -20, prefs)).toEqual({
      emit: false,
      reason: "global_disabled",
    });
    expect(shouldEmitScoreNotification("sharp_drop", -25, prefs)).toEqual({
      emit: false,
      reason: "global_disabled",
    });
    expect(shouldEmitScoreNotification("recovery", 15, prefs)).toEqual({
      emit: false,
      reason: "global_disabled",
    });
  });

  it("event-specific disabled suppresses matching event", () => {
    const prefs: ScoreAlertsPreferences = {
      ...DEFAULT_PREFERENCES,
      events: {
        threshold_breach: false,
        sharp_drop: true,
        recovery: true,
      },
    };
    expect(shouldEmitScoreNotification("threshold_breach", -20, prefs)).toEqual({
      emit: false,
      reason: "event_disabled",
    });
    expect(shouldEmitScoreNotification("sharp_drop", -20, prefs)).toEqual({ emit: true });
    expect(shouldEmitScoreNotification("recovery", 15, prefs)).toEqual({ emit: true });
  });

  it("enabled settings allow notifications", () => {
    const prefs = DEFAULT_PREFERENCES;
    expect(shouldEmitScoreNotification("threshold_breach", -10, prefs)).toEqual({ emit: true });
    expect(shouldEmitScoreNotification("sharp_drop", -20, prefs)).toEqual({ emit: true });
    expect(shouldEmitScoreNotification("recovery", 20, prefs)).toEqual({ emit: true });
  });

  it("sharpDropMinDelta threshold suppresses when below", () => {
    const prefs: ScoreAlertsPreferences = {
      ...DEFAULT_PREFERENCES,
      sharpDropMinDelta: 20,
    };
    expect(shouldEmitScoreNotification("sharp_drop", -15, prefs)).toEqual({
      emit: false,
      reason: "below_min_delta",
    });
    expect(shouldEmitScoreNotification("sharp_drop", -25, prefs)).toEqual({ emit: true });
  });

  it("null prefs uses defaults and allows", () => {
    expect(shouldEmitScoreNotification("threshold_breach", -10, null)).toEqual({ emit: true });
  });
});
