/**
 * Phase 3.6.5: Golden scenario fixtures for regression testing.
 * Deterministic inputs/outputs for core score/notification flows.
 * Use _testOverride where available; avoid flaky timestamps.
 */

import type { ScoreBand } from "./types";

export type GoldenScenarioId =
  | "golden_healthy_no_event"
  | "golden_threshold_breach_to_critical"
  | "golden_sharp_drop_notification"
  | "golden_recovery_to_healthy"
  | "golden_notification_suppressed_by_preferences"
  | "golden_notification_suppressed_by_cooldown";

export type ScoreEventType = "threshold_breach" | "sharp_drop" | "recovery";

export type GoldenScenarioInput = {
  id: GoldenScenarioId;
  name: string;
  description: string;
  /** Prior snapshot state (score, band) — seeded before current compute */
  priorSnapshot?: { score: number; band: ScoreBand };
  /** Current compute override (deterministic) */
  currentOverride: { score: number; band: ScoreBand };
  /** Alert preferences override (optional) */
  preferencesOverride?: {
    enabled?: boolean;
    events?: { threshold_breach?: boolean; sharp_drop?: boolean; recovery?: boolean };
    cooldownMinutes?: number;
  };
};

export type GoldenScenarioExpected = {
  score: number;
  band: ScoreBand;
  delta: number | null;
  /** Expected score event types (or empty if none) */
  scoreEventTypes: ScoreEventType[];
  /** Notification expected? */
  notificationExpected: boolean;
  /** Suppression reason when notification not expected */
  suppressionReason?: "disabled" | "cooldown" | "event_disabled" | "global_disabled";
  /** Top reason labels (first 1–2, order matters) — optional */
  topReasonLabels?: string[];
  /** Factor summary key checks — optional */
  factorSummaryKeys?: string[];
  /** Payload contract: fromScore, toScore, delta, bands, dedupeKey */
  payloadContract?: {
    fromScore?: number;
    toScore?: number;
    delta?: number;
    fromBand?: ScoreBand;
    toBand?: ScoreBand;
    dedupeKeySuffix?: string;
  };
};

export type GoldenScenario = GoldenScenarioInput & {
  expected: GoldenScenarioExpected;
};

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    id: "golden_healthy_no_event",
    name: "Healthy → healthy (small change)",
    description: "No score event, no notification, snapshot persists",
    priorSnapshot: { score: 70, band: "healthy" },
    currentOverride: { score: 72, band: "healthy" },
    expected: {
      score: 72,
      band: "healthy",
      delta: 2,
      scoreEventTypes: [],
      notificationExpected: false,
    },
  },
  {
    id: "golden_threshold_breach_to_critical",
    name: "Warning → critical (threshold breach)",
    description: "threshold_breach event, notification created",
    priorSnapshot: { score: 60, band: "warning" },
    currentOverride: { score: 40, band: "critical" },
    expected: {
      score: 40,
      band: "critical",
      delta: -20,
      scoreEventTypes: ["threshold_breach"],
      notificationExpected: true,
      payloadContract: {
        fromScore: 60,
        toScore: 40,
        delta: -20,
        fromBand: "warning",
        toBand: "critical",
        dedupeKeySuffix: "threshold_breach",
      },
    },
  },
  {
    id: "golden_sharp_drop_notification",
    name: "Healthy → warning (sharp drop)",
    description: "sharp_drop event, notification created, payload contract asserted",
    priorSnapshot: { score: 85, band: "healthy" },
    currentOverride: { score: 65, band: "warning" },
    expected: {
      score: 65,
      band: "warning",
      delta: -20,
      scoreEventTypes: ["sharp_drop"],
      notificationExpected: true,
      payloadContract: {
        fromScore: 85,
        toScore: 65,
        delta: -20,
        fromBand: "healthy",
        toBand: "warning",
        dedupeKeySuffix: "sharp_drop",
      },
    },
  },
  {
    id: "golden_recovery_to_healthy",
    name: "Critical → healthy (recovery)",
    description: "recovery event, notification created",
    priorSnapshot: { score: 45, band: "critical" },
    currentOverride: { score: 85, band: "healthy" },
    expected: {
      score: 85,
      band: "healthy",
      delta: 40,
      scoreEventTypes: ["recovery"],
      notificationExpected: true,
      payloadContract: {
        fromScore: 45,
        toScore: 85,
        delta: 40,
        fromBand: "critical",
        toBand: "healthy",
        dedupeKeySuffix: "recovery",
      },
    },
  },
  {
    id: "golden_notification_suppressed_by_preferences",
    name: "Event created, notification suppressed by preferences",
    description: "Score event stored, no notification event/delivery",
    priorSnapshot: { score: 60, band: "warning" },
    currentOverride: { score: 40, band: "critical" },
    preferencesOverride: { enabled: false },
    expected: {
      score: 40,
      band: "critical",
      delta: -20,
      scoreEventTypes: ["threshold_breach"],
      notificationExpected: false,
      suppressionReason: "global_disabled",
    },
  },
  {
    id: "golden_notification_suppressed_by_cooldown",
    name: "Event created, notification suppressed by cooldown",
    description: "Prior matching notification exists; no duplicate notification (60→46 avoids sharp_drop)",
    priorSnapshot: { score: 60, band: "warning" },
    currentOverride: { score: 46, band: "critical" },
    preferencesOverride: { enabled: true, events: { threshold_breach: true }, cooldownMinutes: 60 },
    expected: {
      score: 46,
      band: "critical",
      delta: -14,
      scoreEventTypes: ["threshold_breach"],
      notificationExpected: false,
      suppressionReason: "cooldown",
    },
  },
];

export function getGoldenScenario(id: GoldenScenarioId): GoldenScenario | undefined {
  return GOLDEN_SCENARIOS.find((s) => s.id === id);
}
