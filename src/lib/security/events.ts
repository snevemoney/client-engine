/**
 * Security event notifications.
 * Uses the existing notification pipeline (createNotificationEvent + queueNotificationDeliveries).
 */
import { createNotificationEvent, queueNotificationDeliveries } from "@/lib/notifications/service";
import { logOpsEventSafe } from "@/lib/ops-events/log";

export type SecurityEventType =
  | "security.rate_limit_burst"
  | "security.auth_failure_burst";

type SecurityEventInput = {
  type: SecurityEventType;
  clientKey: string;
  detail: string;
  meta?: Record<string, unknown>;
};

/**
 * Emit a security notification event. Uses dedupeKey to prevent spam
 * (one notification per event type + clientKey per hour).
 */
export async function emitSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    const dedupeKey = `security:${input.type}:${input.clientKey}`;

    const { id, created } = await createNotificationEvent({
      eventKey: input.type,
      title: formatSecurityTitle(input.type, input.clientKey),
      message: input.detail,
      severity: "warning",
      sourceType: "security",
      sourceId: input.clientKey,
      dedupeKey,
      metaJson: input.meta ?? null,
    });

    if (created) {
      await queueNotificationDeliveries(id, ["in_app"]);
    }

    logOpsEventSafe({
      category: "audit",
      eventKey: input.type,
      level: "warn",
      sourceType: "security",
      sourceId: input.clientKey,
      meta: input.meta,
    });
  } catch {
    // Best-effort: never throw into the request path
  }
}

function formatSecurityTitle(type: SecurityEventType, clientKey: string): string {
  switch (type) {
    case "security.rate_limit_burst":
      return `Rate limit burst from ${clientKey}`;
    case "security.auth_failure_burst":
      return `Repeated auth failures for ${clientKey}`;
    default:
      return `Security event: ${type}`;
  }
}
