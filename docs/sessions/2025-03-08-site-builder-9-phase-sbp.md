# Session: Site Builder 9-Phase SBP Implementation — 2025-03-08

## Goal

Implement the full Site Builder 9-Phase SBP (Site Build Pipeline) as specified in the plan: per-phase execution with approval gates, Brain tools, export, deploy gate, builder integration, and Sprint 6 (Memory, NBA, agent, job queue).

## Decisions Made

- **SBP vs enrichSiteBrief**: When a SiteBuildPlan exists and all 9 phases are approved, builder/create uses `exportSiteBuildPlan` instead of `enrichSiteBrief`. Otherwise falls back to existing enrichment flow.
- **Memory source type**: Added `site_builder` to OperatorMemorySourceType for phase approve/reject events.
- **NBA rules**: Three rules — "Start site build" (active projects with pipelineLeadId, no plan), "Phase N waiting for approval" (complete >24h), "Site ready to deploy" (all 9 approved).
- **Job queue**: `site_builder.phase_run` job type for async phase execution; handler calls `runSitePhase`. Phase runs from dashboard/API remain inline.

## What Was Built

### Sprint 1–5 (from prior session)
- Prisma: SiteBuildPlan, SiteBuildPhase
- Context builder, output validators, orchestrator, export
- API routes: start, plan, phase run/approve/reject/regenerate/output, export, deploy
- Brain tools: get_site_build_plan, run_site_phase
- Dashboard: /dashboard/delivery/[id]/site-builder
- builder/create: branch to use SBP export when plan exists and all 9 phases approved

### Sprint 6 (this session)
- **Migration** `20260311_add_site_builder_memory`: OperatorMemorySourceType + site_builder
- **Memory** `src/lib/memory/site-builder-ingest.ts`: ingestFromSitePhaseApproved, ingestFromSitePhaseRevised
- **Approve/Reject/Regenerate routes**: Call memory ingest after phase state change
- **NBA context** `fetch-context.ts`: siteBuilderNoPlanCount, siteBuilderPhaseAwaitingApprovalCount, siteBuilderReadyToDeployCount
- **NBA rules** `rules.ts`: site_builder_start, site_builder_phase_awaiting_approval, site_builder_ready_to_deploy
- **Scope** `scope.ts`: RULE_SCOPES for new rules
- **Agent** `registry.ts`: site_builder agent (get_site_build_plan, run_site_phase, list_delivery_projects, send_operator_alert)
- **Job** `types.ts`, `runner.ts`, `handlers/site-builder-phase-run.ts`: site_builder.phase_run job type
- **delegate_to_agent**: Added site_builder to worker list in tools.ts
- **builder/create**: Simplified genInput branch — use sbpGenInput when present, else build from enrichment

## Key Insights

- Prisma `phasesCompleted` uses `hasEvery: [1,2,...,9]` for "all 9 approved" query.
- Memory ingest is fire-and-forget (`.catch(() => {})`) so route response isn't blocked.
- site_builder agent's run_site_phase requires approval (in WRITE_TOOLS); autoApprovedTools exclude it.

## Trade-offs Accepted

- Phase runs from dashboard remain inline; job queue is for future cron/async use.
- Phase 9 QA verdict (READY/BLOCKED) not parsed for NBA; "ready to deploy" = all 9 approved.

## Next Steps

- [ ] Run `prisma migrate deploy` on production for 20260311_add_site_builder_memory
- [ ] Optional: add approve_site_phase, get_site_phase_output Brain tools (Sprint 3.4)
- [ ] Optional: enqueue phase runs when >30s (plan says phases >30s enqueued)
