# Session: Phase 2 Architecture Refactor — 2026-03-08

## Goal

Start the Phase 2 architecture refactor per [docs/decisions/007-phase-2-architecture-refactor-impl.md](../decisions/007-phase-2-architecture-refactor-impl.md): extract business logic from route handlers into domain services, and fix coach-tools HTTP self-calls.

## Decisions Made

- **Service layer first** — Extract score, risk, NBA logic into services before refactoring coach-tools. Routes become thin wrappers.
- **Coach-tools direct calls** — Replace `coachFetch(url, opts)` with `scoreService.getSummary()`, etc. Remove `CoachFetchOptions` (baseUrl, cookie); services run server-side.
- **Keep route shapes** — Services return the same shapes as before so route handlers and callers need minimal changes.

## What Was Built

- **Created** `src/lib/services/score-service.ts` — `getSummary`, `getScoreContext`, `getHistory`, `compute`
- **Created** `src/lib/services/risk-service.ts` — `getSummary`, `list`, `runRules`
- **Created** `src/lib/services/nba-service.ts` — `getSummary`, `list`, `runRules`
- **Created** `src/lib/services/lead-service.ts` — `list`, `create`, `getById`, `update`, `deleteLead`, `listForAgent`
- **Modified** `src/lib/copilot/coach-tools.ts` — Uses services instead of fetch; removed `CoachFetchOptions`
- **Modified** `src/lib/copilot/coach-actions.ts` — Removed opts; `runCoachAction(input, actorUserId?)`
- **Modified** `src/app/api/internal/scores/*` — summary, history, compute routes call score-service
- **Modified** `src/app/api/risk/*` — summary, route, run-rules call risk-service
- **Modified** `src/app/api/next-actions/*` — summary, route, run call nba-service
- **Modified** `src/lib/brain/executor.ts` — Passes `ctx.userId` to `runRiskRules` / `runNextActions`; removed fetchOpts; `list_leads` and `update_lead` use lead-service
- **Modified** `src/app/api/leads/route.ts` — Uses `list`, `create` from lead-service
- **Modified** `src/app/api/leads/[id]/route.ts` — Uses `getById`, `update`, `deleteLead`; replaced requireLeadAccess with requireAuth + service
- **Modified** `src/lib/copilot/coach-tools.test.ts` — Mocks services instead of fetch

## Key Insights

- Coach mode no longer incurs HTTP round-trips to self; latency and complexity reduced.
- Services are testable in isolation; coach-tools tests mock services cleanly.
- nba-service `list` when both `status: queued` and `search` are used: `where.OR` for snoozed vs search may conflict; original route had same behavior. Left as-is.

## Trade-offs Accepted

- Lead, Proposal, Delivery, Proof, Signal services not yet implemented; Phase 2 plan items 3–5 remain.
- Brain executor CRUD tools still use direct Prisma; will migrate when those services exist.

## Open Questions

- None.

## Next Steps

- [x] Extract lead-service (done)
- [ ] Extract proposal-service, delivery-service from routes + executor
- [ ] Refactor brain executor CRUD tools for proposals, delivery to use services
- [ ] Extract proof-service, signal-service
- [ ] Audit brain/executor ↔ agents/runner circular dependency
