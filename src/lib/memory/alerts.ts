/**
 * Phase 7.2: Pattern alerts — create RiskFlags + optional notifications.
 */
import { db } from "@/lib/db";
import { RiskSeverity, RiskStatus, RiskSourceType } from "@prisma/client";
import { createNotificationEvent, queueNotificationDeliveries } from "@/lib/notifications/service";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";
import type { PatternAlert } from "./policy";

function toRiskSeverity(s: PatternAlert["severity"]): RiskSeverity {
  switch (s) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    default:
      return "medium";
  }
}

/**
 * Create or update a pattern RiskFlag. Deduped by dedupeKey.
 */
export async function createOrUpdatePatternRiskFlag(params: {
  actorUserId: string;
  ruleKey: string;
  severity: PatternAlert["severity"];
  dedupeKey: string;
  title: string;
  description: string;
}): Promise<{ created: boolean; riskFlagId: string }> {
  const { ruleKey, severity, dedupeKey, title, description } = params;
  const key = `pattern:${ruleKey}`;
  const riskSeverity = toRiskSeverity(severity);
  const now = new Date();

  const existing = await db.riskFlag.findUnique({
    where: { dedupeKey },
  });

  const data = {
    key,
    title,
    description,
    severity: riskSeverity,
    sourceType: RiskSourceType.system,
    sourceId: null,
    actionUrl: "/dashboard/risk",
    suggestedFix: `Review pattern ${ruleKey} and consider suppression or remediation.`,
    evidenceJson: { ruleKey, severity, dedupeKey },
    createdByRule: "memory.pattern_alert",
    lastSeenAt: now,
    status: RiskStatus.open,
  };

  if (existing) {
    await db.riskFlag.update({
      where: { id: existing.id },
      data: { ...data, lastSeenAt: now },
    });
    logOpsEventSafe({
      category: "system",
      eventKey: "memory.pattern_alert.raised",
      sourceType: "risk_flag",
      sourceId: existing.id,
      meta: sanitizeMeta({ ruleKey, severity, updated: true }),
    });
    return { created: false, riskFlagId: existing.id };
  }

  const created = await db.riskFlag.create({
    data: { ...data, dedupeKey },
  });

  logOpsEventSafe({
    category: "system",
    eventKey: "memory.pattern_alert.raised",
    sourceType: "risk_flag",
    sourceId: created.id,
    meta: sanitizeMeta({ ruleKey, severity }),
  });

  if (severity === "critical" || severity === "high") {
    const windowKey = now.toISOString().slice(0, 10);
    const notifDedupe = `risk:pattern:${ruleKey}:${windowKey}`;
    const { id: eventId, created: notifCreated } = await createNotificationEvent({
        eventKey: "memory.pattern_alert",
        title,
        message: description,
        severity: severity === "critical" ? "critical" : "warning",
        sourceType: "risk_flag",
        sourceId: created.id,
        actionUrl: "/dashboard/risk",
        dedupeKey: notifDedupe,
        createdByRule: "memory.pattern_alert",
      });
    if (notifCreated) {
      await queueNotificationDeliveries(eventId, ["in_app"]);
    }
  }

  return { created: true, riskFlagId: created.id };
}
