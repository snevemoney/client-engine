/**
 * Meta Ads V3.3 Alerting — best-effort, non-blocking.
 * Uses sendOperatorAlert; respects cooldown and settings.
 */
import { db } from "@/lib/db";
import { sendOperatorAlert } from "@/lib/notify";

export type AlertEventType =
  | "scheduler_failure"
  | "critical_recommendation"
  | "blocked_action_repeated"
  | "spend_up_no_leads";

export type AlertPayload = {
  eventType: AlertEventType;
  severity: "warn" | "critical";
  accountId: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  ruleKey?: string;
  evidence?: Record<string, unknown>;
  message: string;
};

function getAppUrl(): string {
  const u =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return u || "https://evenslouis.ca";
}

function buildLink(path: string): string {
  return `${getAppUrl()}/dashboard/meta-ads${path}`;
}

/** Cooldown key for dedupe (e.g. "scheduler_failure" or "critical:campaignId:ruleKey") */
function cooldownKey(p: AlertPayload): string {
  if (p.eventType === "critical_recommendation" && p.entityId && p.ruleKey) {
    return `critical:${p.entityId}:${p.ruleKey}`;
  }
  if (p.eventType === "scheduler_failure") return "scheduler_failure";
  if (p.eventType === "blocked_action_repeated") return `blocked:${p.entityId ?? "unknown"}`;
  return p.eventType;
}

/** Check if we're inside cooldown for this key. */
async function isInsideCooldown(
  accountId: string,
  key: string,
  cooldownMinutes: number
): Promise<boolean> {
  const settings = await db.metaAdsAutomationSettings.findUnique({
    where: { accountId },
    select: { lastAlertSentAt: true },
  });
  const lastAt = settings?.lastAlertSentAt as Record<string, string> | null;
  if (!lastAt || typeof lastAt !== "object") return false;
  const ts = lastAt[key];
  if (!ts) return false;
  const sent = new Date(ts).getTime();
  const now = Date.now();
  return now - sent < cooldownMinutes * 60 * 1000;
}

/** Update lastAlertSentAt for key. */
async function markAlertSent(accountId: string, key: string): Promise<void> {
  const settings = await db.metaAdsAutomationSettings.findUnique({
    where: { accountId },
    select: { lastAlertSentAt: true },
  });
  const prev = (settings?.lastAlertSentAt as Record<string, string>) ?? {};
  const next = { ...prev, [key]: new Date().toISOString() };
  await db.metaAdsAutomationSettings.update({
    where: { accountId },
    data: { lastAlertSentAt: next, updatedAt: new Date() },
  });
}

/**
 * Send an alert if enabled and outside cooldown.
 * Fire-and-forget; never throws.
 */
export async function sendMetaAdsAlert(payload: AlertPayload): Promise<boolean> {
  try {
    const settings = await db.metaAdsAutomationSettings.findUnique({
      where: { accountId: payload.accountId },
      select: {
        alertsEnabled: true,
        alertOnSchedulerFailure: true,
        alertOnCriticalRecommendations: true,
        alertOnBlockedActions: true,
        alertCooldownMinutes: true,
        alertMinSeverity: true,
        alertRuleKeys: true,
      },
    });

    if (!settings?.alertsEnabled) return false;

    const cooldown = settings.alertCooldownMinutes ?? 60;
    const minSev = (settings.alertMinSeverity ?? "critical") as "warn" | "critical";
    const sevOrder = { warn: 1, critical: 2 };
    if (sevOrder[payload.severity] < sevOrder[minSev]) return false;

    if (payload.eventType === "scheduler_failure" && !settings.alertOnSchedulerFailure) return false;
    if (payload.eventType === "critical_recommendation" && !settings.alertOnCriticalRecommendations) return false;
    if (payload.eventType === "blocked_action_repeated" && !settings.alertOnBlockedActions) return false;

    const allowlist = settings.alertRuleKeys as string[] | null;
    if (allowlist && allowlist.length > 0 && payload.ruleKey && !allowlist.includes(payload.ruleKey)) {
      return false;
    }

    const key = cooldownKey(payload);
    if (await isInsideCooldown(payload.accountId, key, cooldown)) return false;

    const ev = payload.evidence
      ? Object.entries(payload.evidence)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "";
    const entityLine =
      payload.entityType && payload.entityName
        ? `${payload.entityType} ${payload.entityName} (${payload.entityId ?? ""})`
        : "";
    const ruleLine = payload.ruleKey ? `Rule: ${payload.ruleKey}` : "";
    const body = [payload.message, entityLine, ruleLine, ev]
      .filter(Boolean)
      .join("\n");
    const metaUrl = buildLink("");
    const recsUrl = buildLink("?tab=recommendations");

    const subject = `[Meta Ads] ${payload.severity.toUpperCase()}: ${payload.eventType.replace(/_/g, " ")}`;
    const fullBody = `${body}\n\nMeta Ads: ${metaUrl}\nRecommendations: ${recsUrl}`;

    sendOperatorAlert({
      subject,
      body: fullBody,
      webhookContext: {
        event: payload.eventType,
        message: payload.message,
      },
    });

    await markAlertSent(payload.accountId, key);
    return true;
  } catch {
    return false;
  }
}
