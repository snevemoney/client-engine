# Session: Sprint 2 Pipeline Visibility & Notifications — 2026-03-03

## Goal
Implement Sprint 2: decisions API and page (including MAYBE leads with positioning-only), notification helpers (notifyNewLead, notifyDecisionReadyForLead), and wiring into capture, email ingestion, and pipeline steps.

## Decisions Made
- **Decisions API:** New GET /api/decisions with relaxed artifact filter — includes leads with positioning OR proposal (not just proposal). Returns hasProposal and hasPositioning flags. Snoozed tab returns empty for now (requires decisionSnoozedUntil on Lead).
- **Notifications in steps:** Placed notifyDecisionReadyForLead in pipeline steps (not orchestrator) so lead context is available; runPositionStep notifies for MAYBE + positioning only; runProposeStep notifies for proposal_ready.
- **Positioning-only actions:** For leads without proposal, show "Review" link only; Approve and Approve & Build require proposal artifact.

## What Was Built
- `src/lib/notify.ts` — added notifyNewLead, notifyDecisionReadyForLead
- `src/app/api/decisions/route.ts` — GET with verdict/artifact filters
- `src/app/dashboard/decisions/page.tsx` — server component, fetches via Prisma
- `src/app/dashboard/decisions/DecisionQueue.tsx` — client component with Approve, Approve & Build, inline errors
- `src/app/api/capture/route.ts` — notifyNewLead after lead create
- `src/workers/email-ingestion.ts` — notifyNewLead after lead create
- `src/lib/pipeline/steps.ts` — notifyDecisionReadyForLead in runPositionStep (MAYBE), runProposeStep (proposal_ready)
- `src/components/dashboard/sidebar.tsx` — added Decisions nav item (Convert group)
- `CHANGELOG.md` — Sprint 2 entry

## Key Insights
- Pipeline runs in orchestrator → steps; no separate pipeline-worker. Notifications live in steps to avoid extra DB lookups.
- MAYBE leads get proposals in this pipeline (propose step runs for all). "Positioning only" case occurs when propose fails or is skipped.
- Approve route requires proposal artifact; positioning-only leads get "Review" only.

## Trade-offs Accepted
- Snoozed tab not implemented (would need decisionSnoozedUntil on Lead).
- MAYBE leads may receive two notifications in quick succession (positioning_only then proposal_ready) when pipeline runs fully.

## Next Steps
- [ ] Add decisionSnoozedUntil to Lead and implement Snoozed tab if needed
- [ ] Run npm run docs:generate if routes/models changed (docs:generate exists per CLAUDE.md)
