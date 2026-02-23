/**
 * V3.1 Apply guardrails — protected entities, cooldowns, daily cap.
 * Pure checks; used by apply route before executing Meta action.
 */
export type GuardrailResult =
  | { ok: true }
  | { ok: false; reason: string; status: "blocked" };

type RecWithCampaign = { entityType: string; entityId: string; campaignId: string | null };
type SettingsWithProtected = { protectedCampaignIds?: unknown } | null;
type ActionLogEntry = { status: string; createdAt?: Date };

export function checkProtected(
  rec: RecWithCampaign,
  settings: SettingsWithProtected
): GuardrailResult {
  const protectedIds = (settings?.protectedCampaignIds as string[] | null) ?? [];
  if (protectedIds.length === 0) return { ok: true };

  if (rec.entityType === "campaign" && protectedIds.includes(rec.entityId)) {
    return {
      ok: false,
      reason: `Campaign ${rec.entityId} is protected and cannot be changed.`,
      status: "blocked",
    };
  }
  if ((rec.entityType === "adset" || rec.entityType === "ad") && rec.campaignId && protectedIds.includes(rec.campaignId)) {
    return {
      ok: false,
      reason: `Parent campaign ${rec.campaignId} is protected. Entity ${rec.entityId} cannot be changed.`,
      status: "blocked",
    };
  }
  return { ok: true };
}

export function checkCooldown(
  accountId: string,
  entityType: string,
  entityId: string,
  settings: { actionCooldownMinutes?: number } | null,
  recentActions: ActionLogEntry[]
): GuardrailResult {
  const cooldownMins = settings?.actionCooldownMinutes ?? 720;
  if (cooldownMins <= 0) return { ok: true };

  const cutoff = new Date(Date.now() - cooldownMins * 60 * 1000);
  const recent = recentActions.filter(
    (a) =>
      (a.status === "success" || a.status === "simulated") &&
      a.createdAt &&
      new Date(a.createdAt) >= cutoff
  );
  if (recent.length === 0) return { ok: true };

  const last = recent.sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0))[0];
  return {
    ok: false,
    reason: `Cooldown: ${entityType} ${entityId} was last changed ${last.createdAt ?? "recently"}. Wait ${cooldownMins} min before applying again.`,
    status: "blocked",
  };
}

export function checkDailyCap(
  entityType: string,
  entityId: string,
  settings: { maxActionsPerEntityPerDay?: number } | null,
  todayActions: Array<{ status: string }>
): GuardrailResult {
  const cap = settings?.maxActionsPerEntityPerDay ?? 2;
  if (cap <= 0) return { ok: true };

  const applied = todayActions.filter(
    (a) => a.status === "success" || a.status === "simulated"
  );
  if (applied.length < cap) return { ok: true };

  return {
    ok: false,
    reason: `Daily cap: ${entityType} ${entityId} has ${applied.length} actions today (max ${cap}).`,
    status: "blocked",
  };
}

/** Build compact evidence string for action log. */
export function buildEvidenceMessage(evidence: Record<string, unknown>, ruleKey?: string, severity?: string, confidence?: string): string {
  const parts: string[] = [];
  if (evidence.spend != null) parts.push(`spend=$${Number(evidence.spend).toFixed(0)}`);
  if (evidence.impressions != null) parts.push(`impressions=${evidence.impressions}`);
  if (evidence.clicks != null) parts.push(`clicks=${evidence.clicks}`);
  if (evidence.leads != null) parts.push(`leads=${evidence.leads}`);
  if (evidence.cpl != null) parts.push(`cpl=$${Number(evidence.cpl).toFixed(0)}`);
  if (evidence.ctr != null) parts.push(`ctr=${Number(evidence.ctr).toFixed(2)}%`);
  if (evidence.frequency != null) parts.push(`freq=${Number(evidence.frequency).toFixed(1)}`);
  if (ruleKey) parts.push(`rule=${ruleKey}`);
  if (severity) parts.push(`sev=${severity}`);
  if (confidence) parts.push(`conf=${confidence}`);
  return parts.length > 0 ? parts.join(" · ") : "";
}
