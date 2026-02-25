/**
 * Phase 2.5: Deterministic automation suggestion generator.
 * Manual-approved; no auto-apply.
 */

import type { ReminderRuleInput } from "@/lib/reminders/fetch-rule-input";

export type AutomationSuggestionCandidate = {
  type: string;
  title: string;
  reason: string;
  priority: "low" | "medium" | "high" | "critical";
  sourceType: string | null;
  sourceId: string | null;
  payloadJson: Record<string, unknown>;
  actionUrl: string | null;
  dedupeKey: string;
};

function dedupeKey(type: string, sourceId: string | null): string {
  return sourceId ? `${type}:${sourceId}` : type;
}

export function generateAutomationSuggestions(input: ReminderRuleInput): AutomationSuggestionCandidate[] {
  const suggestions: AutomationSuggestionCandidate[] = [];

  // 1. Schedule proposal follow-up for sent proposals with no date
  for (const p of input.proposals) {
    if (!p.nextFollowUpAt && p.sentAt) {
      suggestions.push({
        type: "create_followup",
        title: `Schedule follow-up for proposal: ${p.title?.slice(0, 40) ?? "Proposal"}`,
        reason: "Proposal sent but no follow-up date set",
        priority: "high",
        sourceType: "proposal",
        sourceId: p.id,
        payloadJson: { proposalId: p.id, suggestedDays: 3 },
        actionUrl: `/dashboard/proposals/${p.id}`,
        dedupeKey: dedupeKey("create_followup_proposal", p.id),
      });
    }
  }

  // 2. Create proof candidate for won deals
  for (const l of input.wonNoProof) {
    suggestions.push({
      type: "create_proof_candidate",
      title: `Create proof candidate for: ${l.title?.slice(0, 40) ?? "Won deal"}`,
      reason: "Won deal has no proof record",
      priority: "medium",
      sourceType: "intake_lead",
      sourceId: l.id,
      payloadJson: { intakeLeadId: l.id },
      actionUrl: `/dashboard/intake/${l.id}`,
      dedupeKey: dedupeKey("create_proof_candidate", l.id),
    });
  }

  // 3. Promote proof candidate
  for (const pc of input.proofCandidatesReady) {
    suggestions.push({
      type: "promote_proof_candidate",
      title: `Promote proof: ${pc.title?.slice(0, 40) ?? "Candidate"}`,
      reason: "Proof candidate is ready and awaiting promotion",
      priority: "medium",
      sourceType: "proof_candidate",
      sourceId: pc.id,
      payloadJson: { proofCandidateId: pc.id },
      actionUrl: `/dashboard/proof-candidates/${pc.id}`,
      dedupeKey: dedupeKey("promote_proof_candidate", pc.id),
    });
  }

  // 4. Request testimonial from completed deliveries (handoff done, testimonial not requested)
  for (const d of input.deliveryProjects) {
    if ((d.status === "completed" || d.status === "archived") && d.handoffCompletedAt && !d.testimonialRequestedAt) {
      suggestions.push({
        type: "request_testimonial",
        title: `Request testimonial for: ${d.title?.slice(0, 40) ?? "Delivery"}`,
        reason: "Handoff complete; request testimonial or follow up",
        priority: "medium",
        sourceType: "delivery_project",
        sourceId: d.id,
        payloadJson: { deliveryProjectId: d.id },
        actionUrl: `/dashboard/delivery/${d.id}`,
        dedupeKey: dedupeKey("request_testimonial", d.id),
      });
    }
  }

  // 5. Capture weekly snapshots (batch)
  const needsMetrics = !input.weeklyMetricSnapshot;
  const needsOperator = !input.operatorScoreSnapshot;
  const needsForecast = !input.forecastSnapshot;
  if (needsMetrics || needsOperator || needsForecast) {
    const parts: string[] = [];
    if (needsMetrics) parts.push("metrics");
    if (needsOperator) parts.push("operator score");
    if (needsForecast) parts.push("forecast");
    suggestions.push({
      type: "capture_snapshot",
      title: `Capture weekly snapshots: ${parts.join(", ")}`,
      reason: "Weekly snapshots not yet captured for this week",
      priority: "low",
      sourceType: null,
      sourceId: null,
      payloadJson: { snapshots: { metrics: needsMetrics, operatorScore: needsOperator, forecast: needsForecast } },
      actionUrl: "/dashboard/intelligence",
      dedupeKey: "capture_snapshot:weekly",
    });
  }

  // 6. Complete weekly review
  if (!input.strategyWeek?.review?.completedAt) {
    suggestions.push({
      type: "complete_review",
      title: "Complete weekly strategy review",
      reason: "Weekly review not yet completed",
      priority: "high",
      sourceType: "review",
      sourceId: null,
      payloadJson: {},
      actionUrl: "/dashboard/reviews",
      dedupeKey: "complete_review:weekly",
    });
  }

  return suggestions;
}
