/**
 * Phase 4.1: Structured "Why this action" explanations.
 */

import type { NextActionContext } from "./types";

export type ExplanationEvidence = {
  label: string;
  value: string | number;
  source: string;
};

export type ExplanationLink = {
  label: string;
  href: string;
};

export type NextActionExplanation = {
  ruleKey: string;
  summary: string;
  evidence: ExplanationEvidence[];
  recommendedSteps: string[];
  links?: ExplanationLink[];
};

export function buildNextActionExplanation(
  ruleKey: string,
  ctx: NextActionContext,
  overrides?: Partial<NextActionExplanation>
): NextActionExplanation {
  const base = getBaseExplanation(ruleKey, ctx);
  return { ...base, ...overrides };
}

function getBaseExplanation(ruleKey: string, ctx: NextActionContext): NextActionExplanation {
  switch (ruleKey) {
    case "score_in_critical_band":
      return {
        ruleKey,
        summary: "Command center health score is in the critical band and needs investigation.",
        evidence: [
          { label: "Score band", value: ctx.commandCenterBand ?? "unknown", source: "db:ScoreSnapshot" },
        ],
        recommendedSteps: [
          "Open scoreboard and review top negative factors",
          "Check recent score events for sharp drops",
          "Address highest-impact factors first",
        ],
        links: [{ label: "Scoreboard", href: "/dashboard/internal/scoreboard" }],
      };

    case "failed_notification_deliveries":
      return {
        ruleKey,
        summary: "One or more notification deliveries failed in the last 24 hours.",
        evidence: [
          { label: "Failed count", value: ctx.failedDeliveryCount, source: "db:NotificationDelivery" },
        ],
        recommendedSteps: [
          "Open Notifications page and filter by failed",
          "Retry failed deliveries or fix channel config",
          "Check delivery logs for error details",
        ],
        links: [{ label: "Notifications", href: "/dashboard/notifications?filter=failed" }],
      };

    case "overdue_reminders_high_priority":
      return {
        ruleKey,
        summary: "High-priority reminders are overdue and need attention.",
        evidence: [
          { label: "Overdue count", value: ctx.overdueRemindersCount, source: "db:OpsReminder" },
        ],
        recommendedSteps: [
          "Open Reminders and filter by overdue",
          "Complete or reschedule each overdue reminder",
          "Clear the backlog to avoid cascading delays",
        ],
        links: [{ label: "Reminders", href: "/dashboard/reminders?bucket=overdue" }],
      };

    case "proposals_sent_no_followup_date":
      return {
        ruleKey,
        summary: "Proposals have been sent but have no follow-up date scheduled.",
        evidence: [
          { label: "Count", value: ctx.sentNoFollowupDateCount, source: "db:Proposal" },
        ],
        recommendedSteps: [
          "Open Proposal Follow-ups page",
          "Set next follow-up date for each sent proposal",
          "Add to calendar or reminder system",
        ],
        links: [{ label: "Proposal Follow-ups", href: "/dashboard/proposal-followups?bucket=no_followup" }],
      };

    case "retention_overdue":
      return {
        ruleKey,
        summary: "Retention follow-ups for completed projects are overdue.",
        evidence: [
          { label: "Overdue count", value: ctx.retentionOverdueCount, source: "db:DeliveryProject" },
        ],
        recommendedSteps: [
          "Open Retention page and filter by overdue",
          "Contact each client for check-in",
          "Update retention next follow-up date",
        ],
        links: [{ label: "Retention", href: "/dashboard/retention?bucket=overdue" }],
      };

    case "handoff_no_client_confirm":
      return {
        ruleKey,
        summary: "Handoffs are complete but awaiting client confirmation.",
        evidence: [
          { label: "Awaiting count", value: ctx.handoffNoClientConfirmCount, source: "db:DeliveryProject" },
        ],
        recommendedSteps: [
          "Open Handoffs page",
          "Request client confirmation for each handoff",
          "Document confirmation when received",
        ],
        links: [{ label: "Handoffs", href: "/dashboard/handoffs?bucket=awaiting_confirm" }],
      };

    case "flywheel_won_no_delivery":
      return {
        ruleKey,
        summary: "Won deals have no delivery project created.",
        evidence: [
          { label: "Gap count", value: ctx.wonNoDeliveryCount, source: "db:Lead" },
        ],
        recommendedSteps: [
          "Create delivery project for each won deal",
          "Link project to lead and set milestones",
          "Schedule kickoff with client",
        ],
        links: [{ label: "New Delivery", href: "/dashboard/delivery/new" }],
      };

    case "flywheel_referral_gap":
      return {
        ruleKey,
        summary: "Won deals have not had a referral request.",
        evidence: [
          { label: "Gap count", value: ctx.referralGapCount, source: "db:Lead" },
        ],
        recommendedSteps: [
          "Review won deals from last 7+ days",
          "Ask satisfied clients for referrals",
          "Update referral ask status on each lead",
        ],
        links: [{ label: "Leads", href: "/dashboard/leads" }],
      };

    case "flywheel_stage_stall":
      return {
        ruleKey,
        summary: "Active leads have had no contact for 10+ days.",
        evidence: [
          { label: "Stalled count", value: ctx.stageStallCount, source: "db:Lead" },
        ],
        recommendedSteps: [
          "Review stalled leads",
          "Re-engage with a light touch (check-in, value add)",
          "Update last contact date",
        ],
        links: [{ label: "Leads", href: "/dashboard/leads" }],
      };

    default:
      return {
        ruleKey,
        summary: "Action recommended based on current system state.",
        evidence: [],
        recommendedSteps: ["Review the action", "Take the recommended step", "Mark done when complete"],
      };
  }
}
