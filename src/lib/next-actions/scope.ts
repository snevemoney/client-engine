/**
 * Phase 4.1: NBA scope definitions.
 * Per-scope views: command_center vs review_stream.
 */

export const NBA_SCOPES = ["command_center", "review_stream"] as const;
export type NBAScope = (typeof NBA_SCOPES)[number];

export const DEFAULT_SCOPE: NBAScope = "command_center";

export function parseScope(entityType: string | null, entityId: string | null): { entityType: NBAScope; entityId: string } {
  const type = entityType && NBA_SCOPES.includes(entityType as NBAScope) ? (entityType as NBAScope) : DEFAULT_SCOPE;
  const id = entityId?.trim() || type;
  return { entityType: type, entityId: id };
}

/** Which scopes each rule produces actions for */
export const RULE_SCOPES: Record<string, NBAScope[]> = {
  score_in_critical_band: ["command_center"],
  failed_notification_deliveries: ["command_center"],
  overdue_reminders_high_priority: ["command_center", "review_stream"],
  proposals_sent_no_followup_date: ["command_center", "review_stream"],
  retention_overdue: ["command_center", "review_stream"],
  handoff_no_client_confirm: ["command_center", "review_stream"],
  flywheel_won_no_delivery: ["command_center"],
  flywheel_referral_gap: ["command_center"],
  flywheel_stage_stall: ["command_center"],
};
