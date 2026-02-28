/**
 * Phase 4.4: NBA Templates (Playbooks) — structured "what to do + steps + links + suggested actions".
 * Code-based registry keyed by ruleKey. No DB.
 * Client-safe: no server imports.
 */

export type NextActionTemplate = {
  ruleKey: string;
  title: string;
  outcome: string;
  why: string;
  checklist: Array<{ id: string; text: string; optional?: boolean }>;
  links?: Array<{ label: string; href: string }>;
  suggestedActions?: Array<{
    actionKey: string;
    label: string;
    confirm?: { title: string; body: string };
  }>;
};

const TEMPLATES: Record<string, NextActionTemplate> = {
  score_in_critical_band: {
    ruleKey: "score_in_critical_band",
    title: "Investigate top score reasons",
    outcome: "Score moves out of critical band; top factors addressed.",
    why: "Command center health is in the critical band. Ignoring it risks cascading issues.",
    checklist: [
      { id: "1", text: "Open scoreboard and review top negative factors" },
      { id: "2", text: "Check recent score events for sharp drops" },
      { id: "3", text: "Address highest-impact factors first" },
    ],
    links: [{ label: "Scoreboard", href: "/dashboard/internal/scoreboard" }],
    suggestedActions: [
      { actionKey: "recompute_score", label: "Recompute score", confirm: { title: "Refresh score?", body: "Recalculate command center score now." } },
      { actionKey: "mark_done", label: "Mark done" },
    ],
  },

  failed_notification_deliveries: {
    ruleKey: "failed_notification_deliveries",
    title: "Retry failed deliveries",
    outcome: "Failed deliveries retried or channel config fixed.",
    why: "Notification deliveries failed. Recipients may miss critical alerts.",
    checklist: [
      { id: "1", text: "Open Notifications page and filter by failed" },
      { id: "2", text: "Retry failed deliveries or fix channel config" },
      { id: "3", text: "Check delivery logs for error details" },
    ],
    links: [{ label: "Notifications", href: "/dashboard/notifications?filter=failed" }],
    suggestedActions: [
      { actionKey: "retry_failed_deliveries", label: "Retry failed deliveries", confirm: { title: "Enqueue retry?", body: "Enqueue retry job for failed deliveries." } },
      { actionKey: "mark_done", label: "Mark done" },
    ],
  },

  overdue_reminders_high_priority: {
    ruleKey: "overdue_reminders_high_priority",
    title: "Clear overdue reminders",
    outcome: "Overdue reminders completed or rescheduled.",
    why: "High-priority reminders are overdue. Clearing them prevents cascading delays.",
    checklist: [
      { id: "1", text: "Open Reminders and filter by overdue" },
      { id: "2", text: "Complete or reschedule each overdue reminder" },
      { id: "3", text: "Clear the backlog" },
    ],
    links: [{ label: "Reminders", href: "/dashboard/reminders?bucket=overdue" }],
    suggestedActions: [{ actionKey: "mark_done", label: "Mark done" }],
  },

  proposals_sent_no_followup_date: {
    ruleKey: "proposals_sent_no_followup_date",
    title: "Schedule follow-up dates",
    outcome: "Every sent proposal has a next follow-up date.",
    why: "Proposals without follow-up dates fall through the cracks.",
    checklist: [
      { id: "1", text: "Open Proposal Follow-ups page" },
      { id: "2", text: "Set next follow-up date for each sent proposal" },
      { id: "3", text: "Add to calendar or reminder system" },
    ],
    links: [{ label: "Proposal Follow-ups", href: "/dashboard/proposal-followups?bucket=no_followup" }],
    suggestedActions: [{ actionKey: "mark_done", label: "Mark done" }],
  },

  retention_overdue: {
    ruleKey: "retention_overdue",
    title: "Contact retention clients",
    outcome: "Retention follow-ups completed; next dates set.",
    why: "Completed projects need check-ins to maintain relationships and spot upsell.",
    checklist: [
      { id: "1", text: "Open Retention page and filter by overdue" },
      { id: "2", text: "Contact each client for check-in" },
      { id: "3", text: "Update retention next follow-up date" },
    ],
    links: [{ label: "Retention", href: "/dashboard/retention?bucket=overdue" }],
    suggestedActions: [{ actionKey: "mark_done", label: "Mark done" }],
  },

  handoff_no_client_confirm: {
    ruleKey: "handoff_no_client_confirm",
    title: "Request client confirmation",
    outcome: "Handoffs confirmed by clients.",
    why: "Handoffs without client confirmation leave delivery status unclear.",
    checklist: [
      { id: "1", text: "Open Handoffs page" },
      { id: "2", text: "Request client confirmation for each handoff" },
      { id: "3", text: "Document confirmation when received" },
    ],
    links: [{ label: "Handoffs", href: "/dashboard/handoffs?bucket=awaiting_confirm" }],
    suggestedActions: [{ actionKey: "mark_done", label: "Mark done" }],
  },

  flywheel_won_no_delivery: {
    ruleKey: "flywheel_won_no_delivery",
    title: "Create delivery projects for won deals",
    outcome: "Every won deal has a delivery project.",
    why: "Won deals without delivery projects delay handoff and risk client churn.",
    checklist: [
      { id: "1", text: "Create delivery project for each won deal" },
      { id: "2", text: "Link project to lead and set milestones" },
      { id: "3", text: "Schedule kickoff with client" },
    ],
    links: [{ label: "New Delivery", href: "/dashboard/delivery/new" }],
    suggestedActions: [{ actionKey: "mark_done", label: "Mark done" }],
  },

  flywheel_referral_gap: {
    ruleKey: "flywheel_referral_gap",
    title: "Ask for referrals on won deals",
    outcome: "Referral ask status updated; referrals received where possible.",
    why: "Satisfied clients are the best source of new leads.",
    checklist: [
      { id: "1", text: "Review won deals from last 7+ days" },
      { id: "2", text: "Ask satisfied clients for referrals" },
      { id: "3", text: "Update referral ask status on each lead" },
    ],
    links: [{ label: "Leads", href: "/dashboard/leads" }],
    suggestedActions: [{ actionKey: "mark_done", label: "Mark done" }],
  },

  flywheel_stage_stall: {
    ruleKey: "flywheel_stage_stall",
    title: "Re-engage stalled leads",
    outcome: "Stalled leads re-engaged; last contact updated.",
    why: "Leads with no contact for 10+ days go cold without a light touch.",
    checklist: [
      { id: "1", text: "Review stalled leads" },
      { id: "2", text: "Re-engage with a light touch (check-in, value add)" },
      { id: "3", text: "Update last contact date" },
    ],
    links: [{ label: "Leads", href: "/dashboard/leads" }],
    suggestedActions: [{ actionKey: "mark_done", label: "Mark done" }],
  },
};

/** Default template when ruleKey has no specific playbook. */
const DEFAULT_TEMPLATE: NextActionTemplate = {
  ruleKey: "default",
  title: "Complete this action",
  outcome: "Action completed and marked done.",
  why: "Action recommended based on current system state.",
  checklist: [
    { id: "1", text: "Review the action" },
    { id: "2", text: "Take the recommended step" },
    { id: "3", text: "Mark done when complete" },
  ],
  suggestedActions: [{ actionKey: "mark_done", label: "Mark done" }],
};

/**
 * Get template for a ruleKey. Returns default if not found.
 */
export function getTemplate(ruleKey: string | null | undefined): NextActionTemplate {
  if (!ruleKey) return DEFAULT_TEMPLATE;
  const t = TEMPLATES[ruleKey];
  return t ? { ...t } : { ...DEFAULT_TEMPLATE, ruleKey };
}

/**
 * Get template for a ruleKey. Returns null if not in registry (for API: null = unknown).
 */
export function getTemplateOrNull(ruleKey: string | null | undefined): NextActionTemplate | null {
  if (!ruleKey) return null;
  const t = TEMPLATES[ruleKey];
  return t ? { ...t } : null;
}

/**
 * List all registered ruleKeys (for debugging or admin).
 */
export function listTemplateRuleKeys(): string[] {
  return Object.keys(TEMPLATES);
}
