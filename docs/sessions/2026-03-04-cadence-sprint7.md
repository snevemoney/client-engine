# Session: Cadence Model Sprint 7 — 2026-03-04

## Goal
Implement the polymorphic Cadence model with creation hooks for SCOPE_SENT, deployed, and invoiced triggers.

## Decisions Made
- Polymorphic Cadence: `sourceType` + `sourceId` so cadences attach to Lead, DeliveryProject, or Project depending on trigger
- Fire-and-forget cadence creation: `createCadence` logs errors but does not block the main flow
- Invoiced cadence only when transitioning: create cadence when paymentStatus changes from non-invoiced to invoiced/partial (avoids duplicates on repeated PATCH)

## What Was Built
- `prisma/schema.prisma` — Cadence model with sourceType, sourceId, trigger, dueAt, completedAt, snoozedUntil
- `src/lib/cadence/service.ts` — createCadence(sourceType, sourceId, trigger) with TRIGGER_DAYS (3, 7, 14)
- `src/app/api/leads/[id]/status/route.ts` — create cadence when status → SCOPE_SENT
- `src/app/api/delivery-projects/[id]/builder/deploy/route.ts` — create cadence when sync deploy completes
- `src/workers/index.ts` — create cadence when builder-deploy worker completes
- `src/app/api/projects/[id]/route.ts` — create cadence when paymentStatus → invoiced/partial (transition check)

## Key Insights
- Builder deploy has two paths: sync (route) and async (worker). Both must create cadence.
- Payment fields live on Project; deploy is on DeliveryProject. Polymorphic cadence covers both.

## Trade-offs Accepted
- No deduplication: multiple cadences can be created for same source+trigger if events fire repeatedly (e.g. status toggled). Orchestrator/cron can later consume and mark completed.

## Next Steps
- Sprint 7 cadence orchestrator: cron/job to process due cadences and surface reminders (e.g. Command Center, notifications)
