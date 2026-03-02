/**
 * Full Flywheel Orchestrator
 *
 * Chains the entire agentic pipeline from prospect data to website build:
 *
 *   Prospect Data → Lead → Pipeline (enrich/score/position/propose)
 *     → Proposal (auto-send) → Accept → DeliveryProject → Builder
 *
 * Each step is logged so you can trace the full automation path.
 * Designed for programmatic use — no manual clicks required.
 */

import { db } from "@/lib/db";
import { runPipelineIfEligible } from "@/lib/pipeline/orchestrator";
import type { BuilderIndustryPreset } from "@/lib/builder/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlywheelInput = {
  /** If set, use this existing lead instead of creating a new one */
  leadId?: string;
  /** Prospect name / business title */
  title: string;
  /** Source platform (e.g. "instagram", "facebook", "linkedin") */
  source?: string;
  sourceUrl?: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  company?: string;
  /** Budget range as string (e.g. "$2,000-$5,000") */
  budget?: string;
  timeline?: string;
  tags?: string[];
  /** Builder industry preset to use when creating the website */
  builderPreset?: BuilderIndustryPreset;
  /** Pages to include in the website */
  builderScope?: string[];
  /** Extra content hints for AI content generation (e.g. prospect bio, niche, services) */
  contentHints?: string;
  /** If false, proposal stays in "draft" — not auto-sent. Default true. */
  autoSendProposal?: boolean;
  /** If false, skip website builder step. Default true. */
  autoBuild?: boolean;
};

export type FlywheelStep = {
  step: string;
  status: "ok" | "skipped" | "error";
  detail: string;
  reasoning: string;
  entityId?: string;
  durationMs: number;
};

export type FlywheelResult = {
  ok: boolean;
  steps: FlywheelStep[];
  leadId: string | null;
  proposalId: string | null;
  deliveryProjectId: string | null;
  builderSiteId: string | null;
  totalDurationMs: number;
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runFlywheel(input: FlywheelInput): Promise<FlywheelResult> {
  const t0 = Date.now();
  const steps: FlywheelStep[] = [];
  let leadId: string | null = null;
  let proposalId: string | null = null;
  let deliveryProjectId: string | null = null;
  let builderSiteId: string | null = null;

  function log(step: string, status: "ok" | "skipped" | "error", detail: string, reasoning: string, entityId?: string) {
    steps.push({ step, status, detail, reasoning, entityId, durationMs: Date.now() - t0 });
  }

  try {
    // ── Step 1: Create or load Lead ─────────────────────────────────────
    let lead;
    if (input.leadId) {
      lead = await db.lead.findUnique({ where: { id: input.leadId } });
      if (!lead) throw new Error(`Lead not found: ${input.leadId}`);
      leadId = lead.id;
      log(
        "load_lead", "ok",
        `Using existing lead: ${lead.title}`,
        `Loaded existing lead "${lead.title}" (${lead.id}) to run the full pipeline. Skipping lead creation since this prospect is already in the system.`,
        lead.id,
      );
    } else {
      lead = await db.lead.create({
        data: {
          title: input.title,
          source: input.source ?? "flywheel",
          sourceUrl: input.sourceUrl ?? null,
          description: input.description ?? null,
          contactName: input.contactName ?? null,
          contactEmail: input.contactEmail ?? null,
          budget: input.budget ?? null,
          timeline: input.timeline ?? null,
          tags: input.tags ?? [],
          status: "NEW",
        },
      });
      leadId = lead.id;
      log(
        "create_lead", "ok",
        `Lead created: ${lead.title}`,
        `Prospect "${input.title}" entered the system from ${input.source ?? "flywheel"}. Created as a new lead with status NEW to begin the qualification pipeline.`,
        lead.id,
      );
    }

    // ── Step 2: Run Pipeline (enrich → score → position → propose) ──
    const pipelineResult = await runPipelineIfEligible(lead.id, "flywheel_auto");

    if (!pipelineResult.run) {
      log("pipeline", "error", `Pipeline did not run: ${pipelineResult.reason}`, `Attempted to run the 4-step AI pipeline (enrich → score → position → propose) but it was blocked: ${pipelineResult.reason}`);
      return result();
    }
    log(
      "pipeline", "ok",
      `Pipeline completed: ${pipelineResult.stepsRun} run, ${pipelineResult.stepsSkipped} skipped`,
      `Ran the full AI qualification pipeline: enrich (researched the prospect), score (evaluated fit), position (crafted unique angle), propose (generated proposal). ${pipelineResult.stepsRun} steps executed, ${pipelineResult.stepsSkipped} skipped (already done).`,
      pipelineResult.runId,
    );

    // ── Collect pipeline artifacts for shared context ────────────────
    const [enrichArtifact, positionArtifact, scoredLead] = await Promise.all([
      db.artifact.findFirst({ where: { leadId: lead.id, type: "notes" }, orderBy: { createdAt: "desc" } }),
      db.artifact.findFirst({ where: { leadId: lead.id, type: "positioning" }, orderBy: { createdAt: "desc" } }),
      db.lead.findUnique({ where: { id: lead.id }, select: { score: true, scoreReason: true, scoreVerdict: true, scoreFactors: true } }),
    ]);

    const sharedContext = {
      enrichment: enrichArtifact?.content?.slice(0, 2000) ?? null,
      enrichmentMeta: enrichArtifact?.meta as Record<string, unknown> | null,
      positioning: positionArtifact?.content?.slice(0, 2000) ?? null,
      positioningMeta: positionArtifact?.meta as Record<string, unknown> | null,
      score: scoredLead?.score ?? null,
      scoreReason: scoredLead?.scoreReason ?? null,
      scoreVerdict: scoredLead?.scoreVerdict ?? null,
      scoreFactors: scoredLead?.scoreFactors as Record<string, unknown> | null,
    };

    // ── Step 3: Convert proposal artifact → Proposal record ─────────
    const proposalArtifact = await db.artifact.findFirst({
      where: { leadId: lead.id, type: "proposal" },
      orderBy: { createdAt: "desc" },
    });

    if (!proposalArtifact) {
      log("create_proposal", "error", "Pipeline did not produce a proposal artifact", "The pipeline ran successfully but did not generate a proposal artifact. This may mean the prospect was scored too low or the positioning step couldn't find a viable angle.");
      return result();
    }

    const proposal = await db.proposal.create({
      data: {
        pipelineLeadId: lead.id,
        title: input.title,
        clientName: input.contactName ?? null,
        clientEmail: input.contactEmail ?? null,
        company: input.company ?? null,
        summary: proposalArtifact.content?.slice(0, 500) ?? null,
        scopeOfWork: proposalArtifact.content ?? null,
        priceType: "fixed",
        priceMin: 3000,
        priceCurrency: "CAD",
        status: "draft",
      },
    });
    proposalId = proposal.id;

    await db.lead.update({
      where: { id: lead.id },
      data: { proposalCount: { increment: 1 }, status: "APPROVED", approvedAt: new Date() },
    });

    await db.proposalActivity.create({
      data: {
        proposalId: proposal.id,
        type: "created",
        message: "Auto-created by flywheel from pipeline artifact",
      },
    });

    log(
      "create_proposal", "ok",
      `Proposal created from artifact`,
      `Converted the AI-generated proposal artifact into a formal Proposal record. Scope of work was extracted from the pipeline's propose step. Priced at $3,000 CAD fixed based on default pricing.`,
      proposal.id,
    );

    // ── Step 4: Auto-send proposal (if enabled) ────────────────────
    if (input.autoSendProposal !== false) {
      await db.proposal.update({
        where: { id: proposal.id },
        data: { status: "sent", sentAt: new Date() },
      });
      await db.proposalActivity.create({
        data: {
          proposalId: proposal.id,
          type: "sent",
          message: "Auto-sent by flywheel",
        },
      });
      log(
        "send_proposal", "ok",
        "Proposal auto-sent",
        `Marked the proposal as "sent" to simulate delivery to the client. In production, this would trigger an email notification to ${input.contactEmail ?? "the client"}.`,
        proposal.id,
      );
    } else {
      log(
        "send_proposal", "skipped",
        "Proposal left as draft (auto-send disabled)",
        "Auto-send was disabled for this run. The proposal was created but stays in 'draft' status for manual review before sending.",
        proposal.id,
      );
    }

    // ── Step 5: Auto-accept proposal → creates DeliveryProject ──────
    const now = new Date();
    const { buildDefaultDeliveryChecklist, buildDefaultMilestonesFromProposal } =
      await import("@/lib/delivery/templates");

    const fullProposal = await db.proposal.findUnique({ where: { id: proposal.id } });
    const checklist = buildDefaultDeliveryChecklist();
    const milestones = buildDefaultMilestonesFromProposal(fullProposal!);

    const project = await db.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { status: "accepted", acceptedAt: now, respondedAt: now, responseStatus: "accepted" },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { wonAt: now, dealOutcome: "won", status: "BUILDING", buildStartedAt: now },
      });
      await tx.proposalActivity.create({
        data: {
          proposalId: proposal.id,
          type: "accepted",
          message: "Auto-accepted by flywheel",
        },
      });

      const p = await tx.deliveryProject.create({
        data: {
          proposalId: proposal.id,
          pipelineLeadId: lead.id,
          title: input.title,
          clientName: input.contactName ?? null,
          company: input.company ?? null,
          summary: proposalArtifact.content?.slice(0, 1000) ?? null,
          status: "not_started",
        },
      });

      for (const item of checklist) {
        await tx.deliveryChecklistItem.create({
          data: {
            deliveryProjectId: p.id,
            category: item.category,
            label: item.label,
            isRequired: item.isRequired ?? true,
            sortOrder: item.sortOrder ?? 0,
          },
        });
      }
      for (const m of milestones) {
        await tx.deliveryMilestone.create({
          data: {
            deliveryProjectId: p.id,
            title: m.title,
            description: m.description ?? undefined,
            sortOrder: m.sortOrder ?? 0,
          },
        });
      }
      await tx.deliveryActivity.create({
        data: {
          deliveryProjectId: p.id,
          type: "created",
          message: "Auto-created by flywheel from accepted proposal",
        },
      });
      return p;
    });

    deliveryProjectId = project.id;
    log(
      "accept_and_create_project", "ok",
      `Proposal accepted, DeliveryProject created`,
      `Auto-accepted the proposal and created a DeliveryProject with ${checklist.length} checklist items and ${milestones.length} milestones. The project is ready for the build phase.`,
      project.id,
    );

    // ── Step 6: Trigger website builder (if enabled) ────────────────
    if (input.autoBuild === false) {
      log(
        "trigger_builder", "skipped",
        "Builder skipped (auto-build disabled)",
        "Auto-build was disabled for this run. The delivery project was created but no website was generated. You can trigger the builder manually from the delivery project page.",
      );
    } else {
    // Start builder block
    const preset = input.builderPreset ?? "custom";
    const scope = input.builderScope ?? ["homepage", "about", "services", "contact"];

    // Build rich client context from pipeline artifacts (shared brain)
    const positioningData = sharedContext.positioningMeta?.positioning as Record<string, unknown> | undefined;
    const enrichmentData = sharedContext.enrichmentMeta?.leadIntelligence as Record<string, unknown> | undefined;

    const richClientInfo = {
      name: input.contactName ?? input.title,
      niche: input.contentHints ?? sharedContext.positioningMeta?.positioning
        ? `${(positioningData?.feltProblem as string) ?? ""}`
        : undefined,
      bio: sharedContext.enrichment?.slice(0, 1500) ?? input.contentHints,
      services: positioningData?.packaging
        ? [String(positioningData.packaging)]
        : undefined,
      tone: "professional, warm, approachable",
      // Extended context from pipeline intelligence
      feltProblem: positioningData?.feltProblem as string | undefined,
      reframedOffer: positioningData?.reframedOffer as string | undefined,
      blueOceanAngle: positioningData?.blueOceanAngle as string | undefined,
      languageMap: positioningData?.languageMap as string | undefined,
      scoreVerdict: sharedContext.scoreVerdict ?? undefined,
      scoreReason: sharedContext.scoreReason ?? undefined,
      enrichmentSummary: sharedContext.enrichment?.slice(0, 800) ?? undefined,
      trustSensitivity: enrichmentData?.trustSensitivity as string | undefined,
      safeStartingPoint: enrichmentData?.safeStartingPoint as string | undefined,
    };

    // Guard: skip if site already exists for this project
    if (project.builderSiteId) {
      log(
        "trigger_builder", "skipped",
        `Site already exists: ${project.builderSiteId}`,
        "A builder site was already created for this delivery project. Skipping to avoid duplicates.",
        project.builderSiteId,
      );
    } else try {
      const { createSite, generateContent } = await import("@/lib/builder/client");

      const site = await createSite({
        clientName: input.contactName ?? input.title,
        industry: preset,
        scope,
        contentHints: input.contentHints,
        deliveryProjectId: project.id,
      });

      builderSiteId = site.siteId;

      // Store builder refs on project
      await db.$transaction([
        db.deliveryProject.update({
          where: { id: project.id },
          data: {
            builderSiteId: site.siteId,
            builderPreviewUrl: site.previewUrl,
            builderPreset: preset,
          },
        }),
        db.deliveryActivity.create({
          data: {
            deliveryProjectId: project.id,
            type: "note",
            message: `Website builder: site created (${preset} preset). Preview: ${site.previewUrl}`,
            metaJson: { action: "builder_site_created", siteId: site.siteId, preset, scope },
          },
        }),
      ]);

      // Content generation with full pipeline context (shared brain) + quality check
      const genInput = { sections: scope, clientInfo: richClientInfo };
      generateContent(site.siteId, genInput).then(async () => {
        try {
          const { checkAndReactToQuality } = await import("@/lib/builder/quality-check");
          await checkAndReactToQuality(site.siteId, project.id, genInput);
        } catch (qErr) {
          console.error("[flywheel] quality check failed:", qErr);
        }
      }).catch((err) => console.error("[flywheel] content generation failed:", err));

      log(
        "trigger_builder", "ok",
        `Builder site created: ${site.siteId}`,
        `Created a ${preset} website using the builder service. Passed enrichment data, positioning brief (felt problem, blue ocean angle, language map), and score context to the content generator so the AI writes copy that matches the prospect's exact situation — not generic templates.`,
        site.siteId,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("trigger_builder", "error", `Builder unavailable: ${msg}`, `Attempted to create a ${preset} website but the builder service was unreachable. The flywheel continues without the website — it can be triggered manually later from the delivery project page.`);
    }
    } // End autoBuild else block

    log("complete", "ok", "Flywheel completed successfully", `Full agentic pipeline finished: prospect → lead → qualify → propose → accept → deliver → build. All steps automated, zero manual intervention.`);

    // ── Step 7: Post-flywheel hooks — cascade to all systems ─────────
    try {
      const { postFlywheelHooks } = await import("./post-flywheel-hooks");
      const hookResult = await postFlywheelHooks({
        leadId,
        proposalId,
        deliveryProjectId,
        builderSiteId,
        steps,
      });
      log(
        "post_hooks", "ok",
        `${hookResult.notifications.created} notifs, ${hookResult.jobsEnqueued.length} jobs, NBA: ${hookResult.nextActions.created + hookResult.nextActions.updated}, risk: ${hookResult.riskFlags.created + hookResult.riskFlags.updated}`,
        `Cascaded to all downstream systems: ${hookResult.notifications.created} notifications created, ${hookResult.jobsEnqueued.length} async jobs enqueued (reminders, automation, score, forecast). NBA queue refreshed (${hookResult.nextActions.created} new, ${hookResult.nextActions.updated} updated). Risk flags refreshed (${hookResult.riskFlags.created} new, ${hookResult.riskFlags.updated} updated). Proposal follow-up set to ${hookResult.proposalFollowUp.date ?? "n/a"}. Retention follow-up set to ${hookResult.retentionFollowUp.date ?? "n/a"}. Proof candidate: ${hookResult.proofCandidate.created ? "created" : "skipped"}.`,
      );
    } catch (err) {
      const hookMsg = err instanceof Error ? err.message : String(err);
      log("post_hooks", "error", `Hooks failed: ${hookMsg}`, "Post-flywheel hooks failed but the core flywheel completed successfully. Dashboard pages may not be fully populated until the next scheduled run.");
    }

    // ── Store flywheel log on the delivery project ────────────────────
    if (deliveryProjectId) {
      await db.deliveryActivity.create({
        data: {
          deliveryProjectId,
          type: "note",
          message: "Flywheel automation log",
          metaJson: {
            action: "flywheel_log",
            steps,
            totalDurationMs: Date.now() - t0,
            input: {
              title: input.title,
              source: input.source,
              preset: input.builderPreset,
              contactName: input.contactName,
              company: input.company,
            },
          },
        },
      }).catch(() => {}); // non-fatal
    }

    // ── Store first-class FlywheelRun record ──────────────────────────
    await db.flywheelRun.create({
      data: {
        leadId,
        proposalId,
        deliveryProjectId,
        builderSiteId,
        status: "completed",
        stepsJson: steps,
        totalDurationMs: Date.now() - t0,
        finishedAt: new Date(),
      },
    }).catch(() => {}); // non-fatal
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("fatal", "error", msg, `Unexpected error during flywheel execution. The pipeline may be partially completed — check the steps above for what succeeded.`);

    // Record failed flywheel run
    const failedStep = steps.find((s) => s.status === "error")?.step ?? "unknown";
    await db.flywheelRun.create({
      data: {
        leadId,
        proposalId,
        deliveryProjectId,
        builderSiteId,
        status: "failed",
        stepsJson: steps,
        totalDurationMs: Date.now() - t0,
        failedStep,
        finishedAt: new Date(),
      },
    }).catch(() => {}); // non-fatal
  }

  return result();

  function result(): FlywheelResult {
    return {
      ok: steps.every((s) => s.status !== "error" || s.step === "trigger_builder" || s.step === "post_hooks"),
      steps,
      leadId,
      proposalId,
      deliveryProjectId,
      builderSiteId,
      totalDurationMs: Date.now() - t0,
    };
  }
}
