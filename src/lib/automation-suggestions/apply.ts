/**
 * Phase 2.5: Manual apply for automation suggestions.
 * Safe, idempotent; no external messaging.
 */

import { db } from "@/lib/db";

export type ApplyResult = {
  success: boolean;
  action?: string;
  reminderId?: string;
  error?: string;
  warning?: string;
};

export async function applyAutomationSuggestion(
  suggestion: {
    id: string;
    type: string;
    sourceType: string | null;
    sourceId: string | null;
    payloadJson: unknown;
    actionUrl: string | null;
  }
): Promise<ApplyResult> {
  const payload = (suggestion.payloadJson ?? {}) as Record<string, unknown>;

  switch (suggestion.type) {
    case "create_followup": {
      // Convert to reminder; no direct API call to avoid coupling
      const proposalId = payload.proposalId as string;
      if (!proposalId) return { success: false, error: "Missing proposalId" };
      const reminder = await db.opsReminder.create({
        data: {
          kind: "proposal_followup",
          title: `Schedule follow-up for proposal`,
          description: "Suggestion from automation: set follow-up date",
          status: "open",
          priority: "high",
          sourceType: "proposal",
          sourceId: proposalId,
          actionUrl: `/dashboard/proposals/${proposalId}`,
          suggestedAction: "Set follow-up date",
          createdByRule: "automation_suggestion",
        },
      });
      return { success: true, action: "reminder_created", reminderId: reminder.id };
    }

    case "create_proof_candidate":
    case "promote_proof_candidate":
    case "request_testimonial": {
      // Create reminder linking to the action; no direct domain mutation
      const sourceId = suggestion.sourceId ?? (payload.intakeLeadId ?? payload.proofCandidateId ?? payload.deliveryProjectId) as string;
      const reminder = await db.opsReminder.create({
        data: {
          kind: "automation_suggestion",
          title: suggestion.type === "create_proof_candidate" ? "Create proof candidate" : suggestion.type === "promote_proof_candidate" ? "Promote proof candidate" : "Request testimonial",
          description: `Suggestion: ${suggestion.type}`,
          status: "open",
          priority: "medium",
          sourceType: suggestion.sourceType ?? undefined,
          sourceId: sourceId ?? undefined,
          actionUrl: suggestion.actionUrl ?? undefined,
          suggestedAction: `Open ${suggestion.actionUrl ?? "link"} to complete`,
          createdByRule: "automation_suggestion",
          metaJson: { suggestionType: suggestion.type, suggestionId: suggestion.id },
        },
      });
      return { success: true, action: "reminder_created", reminderId: reminder.id };
    }

    case "capture_snapshot": {
      // Create reminder to capture snapshots
      const snapshots = payload.snapshots as Record<string, boolean> | undefined;
      const parts: string[] = [];
      if (snapshots?.metrics) parts.push("metrics");
      if (snapshots?.operatorScore) parts.push("operator score");
      if (snapshots?.forecast) parts.push("forecast");
      const reminder = await db.opsReminder.create({
        data: {
          kind: "snapshot_due",
          title: `Capture snapshots: ${parts.length > 0 ? parts.join(", ") : "all"}`,
          description: "Weekly snapshots pending",
          status: "open",
          priority: "low",
          sourceType: "metric",
          actionUrl: "/dashboard/intelligence",
          suggestedAction: "Go to Intelligence / Operator / Forecast and capture",
          createdByRule: "automation_suggestion",
          metaJson: { suggestionType: suggestion.type, suggestionId: suggestion.id },
        },
      });
      return { success: true, action: "reminder_created", reminderId: reminder.id };
    }

    case "complete_review": {
      const reminder = await db.opsReminder.create({
        data: {
          kind: "review_due",
          title: "Complete weekly review",
          description: "Suggestion from automation",
          status: "open",
          priority: "high",
          sourceType: "review",
          actionUrl: "/dashboard/reviews",
          suggestedAction: "Complete weekly review",
          createdByRule: "automation_suggestion",
          metaJson: { suggestionType: suggestion.type, suggestionId: suggestion.id },
        },
      });
      return { success: true, action: "reminder_created", reminderId: reminder.id };
    }

    default:
      return { success: false, error: `Unknown suggestion type: ${suggestion.type}` };
  }
}
