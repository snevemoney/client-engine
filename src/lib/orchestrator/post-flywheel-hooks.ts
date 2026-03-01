/**
 * Post-Flywheel Hooks — cascade updates to all downstream systems.
 *
 * After the flywheel completes (Lead → Pipeline → Proposal → Accept → Delivery → Builder),
 * this function fires hooks into every system so dashboard pages are populated:
 *
 *   Sync:  proposal follow-up, retention date, proof candidate, notifications, NBA, risk
 *   Async: reminders, automation suggestions, operator score, forecast, command center score
 *
 * Each hook is independently try/caught — one failure doesn't block others.
 */

import { db } from "@/lib/db";
import {
  ProofCandidateSourceType,
  ProofCandidateTriggerType,
} from "@prisma/client";
import { createNotificationEvent, queueNotificationDeliveries } from "@/lib/notifications/service";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { fetchNextActionContext } from "@/lib/next-actions/fetch-context";
import { produceNextActions } from "@/lib/next-actions/rules";
import { upsertNextActions } from "@/lib/next-actions/service";
import { fetchRiskRuleContext } from "@/lib/risk/fetch-context";
import { evaluateRiskRules } from "@/lib/risk/rules";
import { upsertRiskFlags } from "@/lib/risk/service";
import { logOpsEventSafe } from "@/lib/ops-events/log";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PostFlywheelInput = {
  leadId: string | null;
  proposalId: string | null;
  deliveryProjectId: string | null;
  builderSiteId: string | null;
  steps: { step: string; status: string }[];
};

export type PostFlywheelResult = {
  proposalFollowUp: { set: boolean; date: string | null };
  retentionFollowUp: { set: boolean; date: string | null };
  proofCandidate: { created: boolean; id: string | null };
  notifications: { created: number };
  nextActions: { created: number; updated: number };
  riskFlags: { created: number; updated: number };
  jobsEnqueued: string[];
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function postFlywheelHooks(input: PostFlywheelInput): Promise<PostFlywheelResult> {
  const result: PostFlywheelResult = {
    proposalFollowUp: { set: false, date: null },
    retentionFollowUp: { set: false, date: null },
    proofCandidate: { created: false, id: null },
    notifications: { created: 0 },
    nextActions: { created: 0, updated: 0 },
    riskFlags: { created: 0, updated: 0 },
    jobsEnqueued: [],
  };

  // ── 1. Proposal follow-up date (3 days) ────────────────────────────
  if (input.proposalId) {
    try {
      const followUpDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await db.proposal.update({
        where: { id: input.proposalId },
        data: { nextFollowUpAt: followUpDate },
      });
      result.proposalFollowUp = { set: true, date: followUpDate.toISOString() };
    } catch (e) {
      console.error("[post-flywheel] proposal follow-up failed:", e);
    }
  }

  // ── 2. Retention follow-up (30 days) ───────────────────────────────
  if (input.deliveryProjectId) {
    try {
      const retentionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.deliveryProject.update({
        where: { id: input.deliveryProjectId },
        data: {
          retentionNextFollowUpAt: retentionDate,
          retentionStatus: "monitoring",
        },
      });
      result.retentionFollowUp = { set: true, date: retentionDate.toISOString() };
    } catch (e) {
      console.error("[post-flywheel] retention follow-up failed:", e);
    }
  }

  // ── 3. Auto-create proof candidate from delivery ───────────────────
  if (input.deliveryProjectId && input.leadId) {
    try {
      const project = await db.deliveryProject.findUnique({
        where: { id: input.deliveryProjectId },
        select: {
          id: true,
          title: true,
          clientName: true,
          company: true,
          summary: true,
          deliveryNotes: true,
          githubUrl: true,
          loomUrl: true,
          intakeLeadId: true,
          pipelineLeadId: true,
          proofCandidateId: true,
        },
      });

      if (project && !project.proofCandidateId) {
        const sourceType: ProofCandidateSourceType = project.intakeLeadId
          ? "intake_lead"
          : project.pipelineLeadId
            ? "pipeline_lead"
            : "manual";
        const sourceId = project.intakeLeadId ?? project.pipelineLeadId ?? project.id;
        const triggerType: ProofCandidateTriggerType = project.githubUrl?.trim()
          ? "github"
          : project.loomUrl?.trim()
            ? "loom"
            : "manual";
        const proofSnippet = [project.deliveryNotes?.trim(), project.summary?.trim()]
          .filter(Boolean)
          .join(" ") || "Delivery completed.";

        const candidate = await db.proofCandidate.create({
          data: {
            sourceType,
            sourceId,
            intakeLeadId: project.intakeLeadId ?? undefined,
            leadId: project.pipelineLeadId ?? undefined,
            title: `Delivery proof — ${project.title}`,
            company: project.company ?? project.clientName ?? null,
            triggerType,
            githubUrl: project.githubUrl ?? undefined,
            loomUrl: project.loomUrl ?? undefined,
            deliverySummary: project.deliveryNotes ?? project.summary ?? undefined,
            proofSnippet: proofSnippet.slice(0, 2000),
          },
        });

        await db.$transaction([
          db.deliveryProject.update({
            where: { id: project.id },
            data: { proofCandidateId: candidate.id, proofCapturedAt: new Date() },
          }),
          db.deliveryActivity.create({
            data: {
              deliveryProjectId: project.id,
              type: "handoff",
              message: `Proof candidate auto-created by flywheel: ${candidate.id}`,
              metaJson: { proofCandidateId: candidate.id, triggeredBy: "flywheel" },
            },
          }),
        ]);

        result.proofCandidate = { created: true, id: candidate.id };
      }
    } catch (e) {
      console.error("[post-flywheel] proof candidate failed:", e);
    }
  }

  // ── 4. Notification events ─────────────────────────────────────────
  const notifMilestones: { eventKey: string; title: string; message: string; sourceType: string; sourceId: string | null; actionUrl: string | null }[] = [];

  if (input.leadId) {
    notifMilestones.push({
      eventKey: "flywheel.lead_created",
      title: "Lead created by flywheel",
      message: "A new lead was auto-created and qualified through the AI pipeline.",
      sourceType: "pipeline_lead",
      sourceId: input.leadId,
      actionUrl: `/dashboard/leads/${input.leadId}`,
    });
  }
  if (input.proposalId) {
    notifMilestones.push({
      eventKey: "flywheel.proposal_sent",
      title: "Proposal auto-sent",
      message: "A proposal was auto-generated, sent, and accepted by the flywheel.",
      sourceType: "proposal",
      sourceId: input.proposalId,
      actionUrl: `/dashboard/proposals/${input.proposalId}`,
    });
  }
  if (input.deliveryProjectId) {
    notifMilestones.push({
      eventKey: "flywheel.delivery_created",
      title: "Delivery project created",
      message: "A delivery project was auto-created from an accepted proposal.",
      sourceType: "delivery_project",
      sourceId: input.deliveryProjectId,
      actionUrl: `/dashboard/delivery/${input.deliveryProjectId}`,
    });
  }
  if (input.builderSiteId) {
    notifMilestones.push({
      eventKey: "flywheel.builder_started",
      title: "Website build started",
      message: "The website builder has started creating a site for this client.",
      sourceType: "delivery_project",
      sourceId: input.deliveryProjectId,
      actionUrl: `/dashboard/delivery/${input.deliveryProjectId}`,
    });
  }

  for (const n of notifMilestones) {
    try {
      const { id, created } = await createNotificationEvent({
        eventKey: n.eventKey,
        title: n.title,
        message: n.message,
        severity: "info",
        sourceType: n.sourceType,
        sourceId: n.sourceId ?? undefined,
        actionUrl: n.actionUrl,
        dedupeKey: `flywheel:${n.eventKey}:${n.sourceId}`,
        createdByRule: "flywheel.post_hooks",
        metaJson: { triggeredBy: "flywheel", leadId: input.leadId, proposalId: input.proposalId, deliveryProjectId: input.deliveryProjectId },
      });
      if (created) {
        result.notifications.created++;
        await queueNotificationDeliveries(id).catch(() => {});
      }
    } catch (e) {
      console.error(`[post-flywheel] notification ${n.eventKey} failed:`, e);
    }
  }

  // ── 5. Next actions refresh ────────────────────────────────────────
  try {
    const ctx = await fetchNextActionContext();
    const candidates = produceNextActions(ctx);
    const nbaResult = await upsertNextActions(candidates);
    result.nextActions = { created: nbaResult.created, updated: nbaResult.updated };
  } catch (e) {
    console.error("[post-flywheel] next actions failed:", e);
  }

  // ── 6. Risk flags refresh ─────────────────────────────────────────
  try {
    const ctx = await fetchRiskRuleContext();
    const candidates = evaluateRiskRules(ctx);
    const riskResult = await upsertRiskFlags(candidates);
    result.riskFlags = { created: riskResult.created, updated: riskResult.updated };
  } catch (e) {
    console.error("[post-flywheel] risk flags failed:", e);
  }

  // ── 7. Enqueue async jobs ──────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const jobsToEnqueue: { jobType: "run_reminder_rules" | "generate_automation_suggestions" | "capture_operator_score_snapshot" | "capture_forecast_snapshot" | "score.compute"; dedupeKey: string; payload?: Record<string, unknown> }[] = [
    { jobType: "run_reminder_rules", dedupeKey: `flywheel:reminders:${today}` },
    { jobType: "generate_automation_suggestions", dedupeKey: `flywheel:automation:${today}` },
    { jobType: "capture_operator_score_snapshot", dedupeKey: `flywheel:opscore:${today}` },
    { jobType: "capture_forecast_snapshot", dedupeKey: `flywheel:forecast:${today}` },
    { jobType: "score.compute", dedupeKey: `flywheel:score:${today}`, payload: { entityType: "command_center", entityId: "command_center" } },
  ];

  for (const job of jobsToEnqueue) {
    try {
      const { id, created } = await enqueueJob({
        jobType: job.jobType,
        dedupeKey: job.dedupeKey,
        payload: job.payload as never,
        sourceType: "flywheel",
        sourceId: input.deliveryProjectId ?? input.leadId ?? undefined,
      });
      if (created) result.jobsEnqueued.push(id);
    } catch (e) {
      console.error(`[post-flywheel] enqueue ${job.jobType} failed:`, e);
    }
  }

  // ── 8. Ops event log ───────────────────────────────────────────────
  logOpsEventSafe({
    eventKey: "flywheel.post_hooks",
    category: "automation",
    sourceType: "flywheel",
    sourceId: input.deliveryProjectId ?? input.leadId ?? undefined,
    meta: result,
  });

  return result;
}
