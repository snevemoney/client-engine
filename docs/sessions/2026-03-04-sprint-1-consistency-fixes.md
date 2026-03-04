# Session: Sprint 1 Consistency Fixes — 2026-03-04

## Goal
Implement Sprint 1 of the Process Optimization Plan: four consistency fixes (enrich artifact type, shared scoring constant, inline error for build failure, generalize "Sent on Upwork" label).

## Decisions Made
- **Enrich artifact type:** Standardized to `"enrichment"` via `ENRICHMENT_ARTIFACT_TYPE` and `ENRICHMENT_ARTIFACT_TITLE` constants. Added backward compatibility for existing `"notes"` artifacts so consumers accept both.
- **Shared scoring prompt:** Skipped — codebase already uses single `runScore()` from `score.ts`; no duplicate prompts.
- **Replace alert():** Applied to DeliveryChecklist and DeliveryHandoffRetention (plan's "decisions page" does not exist; these are the closest delivery-related components).
- **"Sent on Upwork" → "Sent":** UI label change only; `sentVia` field deferred to Sprint 3.

## What Was Built
- `src/lib/pipeline/enrich.ts` — Added `ENRICHMENT_ARTIFACT_TYPE`, `ENRICHMENT_ARTIFACT_TITLE`; artifact creation uses them
- `src/lib/pipeline/steps.ts` — `hasEnrichment` and `applyEnrichDelta` use constants; backward compat for "notes"
- `src/lib/pipeline/positioning.ts`, `getLeadIntelligenceForLead.ts` — Import constants; positioning adds OR for legacy "notes"
- `src/app/dashboard/leads/[id]/page.tsx` — `hasEnrichment` helper; uses constants with legacy fallback
- `src/app/api/leads/[id]/driver/ai-fill/route.ts`, `copilot/route.ts` — Use constants; artifact queries include legacy "notes"
- `src/lib/revenue/roi.ts`, `src/lib/ops/opportunityBrief.ts`, `constraint.ts`, `scorecard.ts`, `queueSummary.ts` — Use constants with legacy fallback
- `src/lib/proof-engine/generate.ts` — Use constants with legacy fallback
- `src/app/api/pipeline/retry/[leadId]/route.ts` — Use constants with legacy fallback
- `src/app/api/delivery-projects/[id]/builder/create/route.ts`, `regenerate/route.ts` — Use constants; OR for legacy "notes"
- `src/components/proposals/ProposalConsoleEditor.tsx` — Checkbox label "Sent on Upwork" → "Sent"
- `src/components/delivery/DeliveryChecklist.tsx` — Replaced `alert()` with `error` state and inline red text
- `src/components/delivery/DeliveryHandoffRetention.tsx` — Replaced `alert()` with `error` state and inline red text
- Tests: `enrich.test.ts`, `orchestrator.test.ts`, `positioning.test.ts` — Updated to expect `type: "enrichment"`

## Key Insights
- Plan assumed manual enrich used "notes" and pipeline used "enrichment"; both actually used `runEnrich()` and "notes". Single producer path simplified the change.
- Backward compatibility for existing DB rows required OR conditions in consumers and `hasEnrichment` in steps.
- `queueSummary` hasEnrich needed `title?: string` in type because artifacts from select may omit title.

## Trade-offs Accepted
- No migration to convert existing "notes" enrichment artifacts to "enrichment"; consumers accept both.
- `sentVia` field and channel-aware proposal snippet deferred to Sprint 3.

## Next Steps
- Sprint 2: Pipeline visibility (MAYBE leads, notifications, snoozed tab, split Approve/Approve & Build)
- Sprint 3: Channel-aware outreach (proposal prompt branching by source)
