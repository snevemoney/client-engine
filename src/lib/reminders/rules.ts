/**
 * Phase 2.5: Deterministic reminder rule engine.
 * No background jobs; called manually.
 */

import type { ReminderRuleInput } from "./fetch-rule-input";
import { parseDate } from "./dates";

export type ReminderCandidate = {
  kind: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  dueAt: Date | null;
  sourceType: string | null;
  sourceId: string | null;
  actionUrl: string | null;
  suggestedAction: string | null;
  createdByRule: string;
  dedupeKey: string;
};

function dedupeKey(sourceType: string, sourceId: string, kind: string): string {
  return `${sourceType}:${sourceId}:${kind}`;
}

export function generateReminderCandidates(input: ReminderRuleInput): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = [];
  const now = input.now;
  const msPerDay = 86400000;

  // 1. Proposal follow-up overdue
  for (const p of input.proposals) {
    const due = p.nextFollowUpAt ? parseDate(p.nextFollowUpAt) : null;
    if (due && due.getTime() < now.getTime()) {
      candidates.push({
        kind: "proposal_followup",
        title: `Follow up: ${p.title?.slice(0, 50) ?? "Proposal"}`,
        description: "Proposal follow-up is overdue",
        priority: "high",
        dueAt: due,
        sourceType: "proposal",
        sourceId: p.id,
        actionUrl: `/dashboard/proposals/${p.id}`,
        suggestedAction: "Schedule or complete follow-up",
        createdByRule: "proposal_followup_overdue",
        dedupeKey: dedupeKey("proposal", p.id, "proposal_followup"),
      });
    }
  }

  // 2. Proposal sent with no follow-up date
  for (const p of input.proposals) {
    if (!p.nextFollowUpAt) {
      candidates.push({
        kind: "proposal_followup",
        title: `Set follow-up: ${p.title?.slice(0, 50) ?? "Proposal"}`,
        description: "Proposal sent but no follow-up date set",
        priority: "high",
        dueAt: p.sentAt ? new Date(p.sentAt.getTime() + 3 * msPerDay) : now,
        sourceType: "proposal",
        sourceId: p.id,
        actionUrl: `/dashboard/proposals/${p.id}`,
        suggestedAction: "Schedule follow-up date",
        createdByRule: "proposal_sent_no_followup",
        dedupeKey: dedupeKey("proposal", p.id, "proposal_no_followup"),
      });
    }
  }

  // 3. Stale proposals (no response over threshold)
  for (const p of input.proposals) {
    const threshold = p.staleAfterDays ?? 7;
    if (p.sentAt && !p.respondedAt) {
      const daysSince = Math.floor((now.getTime() - p.sentAt.getTime()) / msPerDay);
      if (daysSince >= threshold) {
        candidates.push({
          kind: "proposal_followup",
          title: `Stale: ${p.title?.slice(0, 50) ?? "Proposal"}`,
          description: `No response for ${daysSince} days`,
          priority: "high",
          dueAt: parseDate(p.sentAt),
          sourceType: "proposal",
          sourceId: p.id,
          actionUrl: `/dashboard/proposals/${p.id}`,
          suggestedAction: "Follow up or close",
          createdByRule: "proposal_stale_7d",
          dedupeKey: dedupeKey("proposal", p.id, "proposal_stale"),
        });
      }
    }
  }

  // 4. Intake follow-up overdue
  for (const l of input.intakeLeads) {
    const due = l.nextActionDueAt ?? l.followUpDueAt;
    const dueDate = parseDate(due);
    if (dueDate && dueDate.getTime() < now.getTime()) {
      candidates.push({
        kind: "intake_followup",
        title: `Follow up: ${l.title?.slice(0, 50) ?? "Intake"}`,
        description: "Intake follow-up overdue",
        priority: "medium",
        dueAt: dueDate,
        sourceType: "intake_lead",
        sourceId: l.id,
        actionUrl: `/dashboard/intake/${l.id}`,
        suggestedAction: "Complete follow-up",
        createdByRule: "intake_followup_overdue",
        dedupeKey: dedupeKey("intake_lead", l.id, "intake_followup"),
      });
    }
  }

  // 5. Won intake with no proof
  for (const l of input.wonNoProof) {
    candidates.push({
      kind: "proof_gap",
      title: `Proof needed: ${l.title?.slice(0, 50) ?? "Won deal"}`,
      description: "Won deal missing proof",
      priority: "medium",
      dueAt: now,
      sourceType: "intake_lead",
      sourceId: l.id,
      actionUrl: `/dashboard/intake/${l.id}`,
      suggestedAction: "Create proof candidate",
      createdByRule: "won_no_proof",
      dedupeKey: dedupeKey("intake_lead", l.id, "proof_gap"),
    });
  }

  // 6. Proof candidate ready but not promoted
  for (const pc of input.proofCandidatesReady) {
    candidates.push({
      kind: "proof_gap",
      title: `Promote proof: ${pc.title?.slice(0, 50) ?? "Candidate"}`,
      description: "Proof candidate ready for promotion",
      priority: "medium",
      dueAt: now,
      sourceType: "proof_candidate",
      sourceId: pc.id,
      actionUrl: `/dashboard/proof-candidates/${pc.id}`,
      suggestedAction: "Review and promote",
      createdByRule: "proof_ready_pending",
      dedupeKey: dedupeKey("proof_candidate", pc.id, "proof_promote"),
    });
  }

  // 7. Delivery overdue
  for (const d of input.deliveryProjects) {
    if (d.dueDate && new Date(d.dueDate).getTime() < now.getTime()) {
      candidates.push({
        kind: "delivery_due",
        title: `Overdue: ${d.title?.slice(0, 50) ?? "Delivery"}`,
        description: "Delivery project overdue",
        priority: "critical",
        dueAt: parseDate(d.dueDate),
        sourceType: "delivery_project",
        sourceId: d.id,
        actionUrl: `/dashboard/delivery/${d.id}`,
        suggestedAction: "Update status or due date",
        createdByRule: "delivery_overdue",
        dedupeKey: dedupeKey("delivery_project", d.id, "delivery_due"),
      });
    }
  }

  // 8. Completed delivery no handoff (need to get from completedProjects - we have count)
  // We don't have individual IDs for completedNoHandoff from the aggregate. Skip per-item or add a separate query.
  // For now, add a single reminder if count > 0
  if (input.completedNoHandoff > 0) {
    candidates.push({
      kind: "handoff_complete",
      title: `${input.completedNoHandoff} completed delivery(ies) need handoff`,
      description: "Complete handoff for these projects",
      priority: "high",
      dueAt: now,
      sourceType: null,
      sourceId: null,
      actionUrl: "/dashboard/handoffs",
      suggestedAction: "Start handoff",
      createdByRule: "completed_no_handoff",
      dedupeKey: "global:completed_no_handoff",
    });
  }

  // 9. Handoff complete no client confirm
  if (input.handoffNoClientConfirm > 0) {
    candidates.push({
      kind: "handoff_complete",
      title: `${input.handoffNoClientConfirm} handoff(s) awaiting client confirm`,
      description: "Follow up for client confirmation",
      priority: "medium",
      dueAt: now,
      sourceType: null,
      sourceId: null,
      actionUrl: "/dashboard/handoffs",
      suggestedAction: "Request client confirmation",
      createdByRule: "handoff_no_client_confirm",
      dedupeKey: "global:handoff_no_client_confirm",
    });
  }

  // 10. Retention follow-up overdue
  for (const d of input.deliveryProjects) {
    const due = d.retentionNextFollowUpAt;
    const dueDate = parseDate(due);
    if (dueDate && dueDate.getTime() < now.getTime() && (d.status === "completed" || d.status === "archived")) {
      candidates.push({
        kind: "retention_followup",
        title: `Retention follow-up: ${d.title?.slice(0, 50) ?? "Delivery"}`,
        description: "Retention follow-up overdue",
        priority: "medium",
        dueAt: dueDate,
        sourceType: "delivery_project",
        sourceId: d.id,
        actionUrl: `/dashboard/delivery/${d.id}`,
        suggestedAction: "Complete retention follow-up",
        createdByRule: "retention_followup_overdue",
        dedupeKey: dedupeKey("delivery_project", d.id, "retention_followup"),
      });
    }
  }

  // 11. Weekly review missing
  if (!input.strategyWeek?.review?.completedAt &&
      now.getTime() >= input.weekStart.getTime() &&
      now.getTime() >= input.weekStart.getTime() + 4 * msPerDay) {
    candidates.push({
      kind: "review_due",
      title: "Weekly review not completed",
      description: "Complete your weekly strategy review",
      priority: "high",
      dueAt: new Date(input.weekStart.getTime() + 6 * msPerDay),
      sourceType: "review",
      sourceId: null,
      actionUrl: "/dashboard/reviews",
      suggestedAction: "Complete weekly review",
      createdByRule: "weekly_review_missing",
      dedupeKey: "global:weekly_review_missing",
    });
  }

  // 12. Metrics snapshot missing this week
  if (!input.weeklyMetricSnapshot) {
    candidates.push({
      kind: "snapshot_due",
      title: "Metrics snapshot missing this week",
      description: "Capture weekly metrics snapshot",
      priority: "low",
      dueAt: new Date(input.weekStart.getTime() + 6 * msPerDay),
      sourceType: "metric",
      sourceId: null,
      actionUrl: "/dashboard/intelligence",
      suggestedAction: "Capture Weekly Snapshot",
      createdByRule: "metrics_snapshot_missing",
      dedupeKey: "global:metrics_snapshot_missing",
    });
  }

  // 13. Operator score snapshot missing this week
  if (!input.operatorScoreSnapshot) {
    candidates.push({
      kind: "snapshot_due",
      title: "Operator score snapshot missing this week",
      description: "Capture operator score snapshot",
      priority: "low",
      dueAt: new Date(input.weekStart.getTime() + 6 * msPerDay),
      sourceType: "metric",
      sourceId: null,
      actionUrl: "/dashboard/operator",
      suggestedAction: "Capture Score Snapshot",
      createdByRule: "operator_score_snapshot_missing",
      dedupeKey: "global:operator_score_snapshot_missing",
    });
  }

  // 14. Forecast snapshot missing this week
  if (!input.forecastSnapshot) {
    candidates.push({
      kind: "snapshot_due",
      title: "Forecast snapshot missing this week",
      description: "Capture forecast snapshot",
      priority: "low",
      dueAt: new Date(input.weekStart.getTime() + 6 * msPerDay),
      sourceType: "metric",
      sourceId: null,
      actionUrl: "/dashboard/forecast",
      suggestedAction: "Capture Forecast Snapshot",
      createdByRule: "forecast_snapshot_missing",
      dedupeKey: "global:forecast_snapshot_missing",
    });
  }

  // ── Flywheel transition nudges ──

  const DEAL_WON_NO_DELIVERY_DAYS = 3;
  const REFERRAL_GAP_DAYS = 7;
  const STAGE_STALL_DAYS = 10;

  for (const l of input.flywheelLeads) {
    // 15. Deal won but no delivery project created
    if (l.dealOutcome === "won" && !l.hasDeliveryProject && l.dealOutcomeAt) {
      const daysSinceWon = Math.floor((now.getTime() - l.dealOutcomeAt.getTime()) / msPerDay);
      if (daysSinceWon >= DEAL_WON_NO_DELIVERY_DAYS) {
        candidates.push({
          kind: "flywheel_gap",
          title: `Create delivery project: ${l.title?.slice(0, 50) ?? "Won deal"}`,
          description: `Deal won ${daysSinceWon}d ago but no delivery project exists`,
          priority: "high",
          dueAt: new Date(l.dealOutcomeAt.getTime() + DEAL_WON_NO_DELIVERY_DAYS * msPerDay),
          sourceType: "lead",
          sourceId: l.id,
          actionUrl: `/dashboard/delivery/new?leadId=${l.id}`,
          suggestedAction: "Create a delivery project for this won deal",
          createdByRule: "flywheel_won_no_delivery",
          dedupeKey: dedupeKey("lead", l.id, "flywheel_won_no_delivery"),
        });
      }
    }

    // 16. Deal won but referral not asked after threshold
    if (l.dealOutcome === "won" && l.referralAskStatus !== "asked" && l.referralAskStatus !== "received" && l.dealOutcomeAt) {
      const daysSinceWon = Math.floor((now.getTime() - l.dealOutcomeAt.getTime()) / msPerDay);
      if (daysSinceWon >= REFERRAL_GAP_DAYS) {
        candidates.push({
          kind: "flywheel_gap",
          title: `Ask for referral: ${l.title?.slice(0, 50) ?? "Won deal"}`,
          description: `Won ${daysSinceWon}d ago — referral not requested yet`,
          priority: "medium",
          dueAt: new Date(l.dealOutcomeAt.getTime() + REFERRAL_GAP_DAYS * msPerDay),
          sourceType: "lead",
          sourceId: l.id,
          actionUrl: `/dashboard/leads/${l.id}`,
          suggestedAction: "Ask for a referral while goodwill is fresh",
          createdByRule: "flywheel_referral_gap",
          dedupeKey: dedupeKey("lead", l.id, "flywheel_referral_gap"),
        });
      }
    }

    // 17. Sales stage stalled (active lead, no contact for too long)
    if (!l.dealOutcome && l.salesStage && l.lastContactAt) {
      const daysSinceContact = Math.floor((now.getTime() - l.lastContactAt.getTime()) / msPerDay);
      if (daysSinceContact >= STAGE_STALL_DAYS) {
        candidates.push({
          kind: "flywheel_gap",
          title: `Stage stall: ${l.title?.slice(0, 50) ?? "Lead"}`,
          description: `No contact for ${daysSinceContact}d in ${(l.salesStage ?? "unknown").replace(/_/g, " ")} stage`,
          priority: daysSinceContact >= STAGE_STALL_DAYS * 2 ? "high" : "medium",
          dueAt: new Date(l.lastContactAt.getTime() + STAGE_STALL_DAYS * msPerDay),
          sourceType: "lead",
          sourceId: l.id,
          actionUrl: `/dashboard/leads/${l.id}`,
          suggestedAction: "Re-engage or update sales stage",
          createdByRule: "flywheel_stage_stall",
          dedupeKey: dedupeKey("lead", l.id, "flywheel_stage_stall"),
        });
      }
    }
  }

  return candidates;
}
