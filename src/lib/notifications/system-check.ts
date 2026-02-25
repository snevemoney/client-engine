/**
 * Phase 2.9: System check for notifications/escalations readiness.
 * Phase 3.4: Score alerts preferences summary.
 */

import { db } from "@/lib/db";
import { getScoreAlertsPreferences } from "@/lib/scores/alerts-preferences";

export type SystemCheckResult = {
  channelsConfigured: { key: string; type: string; isEnabled: boolean }[];
  schedulerEnabled: boolean;
  seedVersion: string | null;
  missingCriticalDefaults: string[];
  featureFlags: Record<string, boolean>;
  environmentMode: string;
  health: {
    hasInAppChannel: boolean;
    hasBaselineEscalationRule: boolean;
    queueConfigured: boolean;
    internalRoutesProtected: boolean;
  };
  scoreAlerts?: {
    configured: boolean;
    enabled: boolean | null;
  };
};

export async function runSystemCheck(): Promise<SystemCheckResult> {
  const [channels, schedules, rules] = await Promise.all([
    db.notificationChannel.findMany({
      select: { key: true, type: true, isEnabled: true },
      orderBy: { key: "asc" },
    }),
    db.jobSchedule.findMany({
      where: { jobType: { contains: "notifications" } },
      select: { key: true, isEnabled: true },
    }),
    db.escalationRule.findMany({
      where: { isEnabled: true },
      select: { key: true },
      take: 1,
    }),
  ]);

  const hasInApp = channels.some((c) => c.key === "in_app" && c.isEnabled);
  const hasBaselineRule = rules.length > 0;
  const schedulerEnabled = schedules.some((s) => s.isEnabled);
  const queueConfigured = schedules.length > 0;

  const missing: string[] = [];
  if (!hasInApp) missing.push("in_app_channel");
  if (!hasBaselineRule) missing.push("baseline_escalation_rule");
  if (!queueConfigured) missing.push("notification_schedules");

  const envMode = process.env.NODE_ENV ?? "development";

  let scoreAlerts: { configured: boolean; enabled: boolean | null } | undefined;
  try {
    const prefs = await getScoreAlertsPreferences();
    const row = await db.internalSetting.findUnique({
      where: { key: "score_alerts_preferences" },
    });
    scoreAlerts = {
      configured: !!row,
      enabled: row ? prefs.enabled : null,
    };
  } catch {
    scoreAlerts = undefined;
  }

  return {
    channelsConfigured: channels.map((c) => ({
      key: c.key,
      type: c.type,
      isEnabled: c.isEnabled,
    })),
    schedulerEnabled,
    seedVersion: null,
    missingCriticalDefaults: missing,
    featureFlags: {
      notificationsPhase3: false,
      webhookDelivery: channels.some((c) => c.type === "webhook" && c.isEnabled),
    },
    environmentMode: envMode,
    health: {
      hasInAppChannel: hasInApp,
      hasBaselineEscalationRule: hasBaselineRule,
      queueConfigured,
      internalRoutesProtected: true,
    },
    scoreAlerts,
  };
}
