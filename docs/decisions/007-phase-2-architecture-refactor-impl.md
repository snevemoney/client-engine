# Implementation Plan: Phase 2 — Architecture Refactor

## Status: In Progress

## Goal

Extract business logic from route handlers into domain services. Routes become thin: validate input → call service → return response. Brain executor and agents call services directly instead of HTTP or duplicated logic.

## Scope

1. Extract Brain executor CRUD into domain services (leads, proposals, delivery, proof, signals)
2. Extract heavy route logic into services (promote, mark-won, complete, capture, simulate, founder-summary)
3. Break brain/executor ↔ agents/runner circular dependency
4. Fix coach-tools HTTP self-calls → direct service calls

## Current State

### Brain Executor

- `src/lib/brain/executor.ts` — 25 tools, each with inline DB calls via `db.*`
- Tools: `update_lead`, `update_proposal`, `update_delivery_project`, `list_leads`, `list_proposals`, `list_delivery_projects`, `list_proof_records`, `list_signals`, etc.
- No HTTP calls; direct Prisma usage. Logic is duplicated with route handlers.

### Coach-Tools (HTTP Self-Calls)

- `src/lib/copilot/coach-tools.ts` — Fetches from internal API routes:
  - `getScoreContext` → `/api/internal/scores/summary`, `/api/internal/scores/history`
  - `getRiskContext` → `/api/risk/summary`, `/api/risk`
  - `getNBAContext` → `/api/next-actions/summary`, `/api/next-actions`
  - `runRecomputeScore`, `runRiskRules`, `runNextActions` → POST to internal routes
- Coach route passes `baseUrl` + `cookie`; coach-tools builds URLs and fetches. Same process, HTTP overhead.

### Heavy Routes

- `promote`, `mark-won`, `complete`, `capture` — lead/proposal lifecycle
- `simulate` — flywheel simulation
- `founder-summary` — aggregate founder data

## Implementation Approach

### 1. Create Service Layer

```
src/lib/services/
  lead-service.ts      — create, update, promote, capture, list
  proposal-service.ts  — create, update, mark-won, list
  delivery-service.ts  — create, update, complete, milestones, list
  proof-service.ts     — list, create candidate, request
  signal-service.ts    — list, match opportunities
  score-service.ts     — getSummary, getHistory, compute (used by coach + scoreboard)
  risk-service.ts      — getSummary, list, runRules (used by coach + risk routes)
  nba-service.ts       — getSummary, list, runRules, execute (used by coach + NBA routes)
```

### 2. Coach-Tools → Direct Service Calls

- Replace `coachFetch(url, opts)` with `scoreService.getSummary(entityType, entityId)`, etc.
- Remove `CoachFetchOptions` (baseUrl, cookie) — services run server-side, no HTTP.
- Coach route and coach/action route call services directly. Session/auth already validated at route level.

### 3. Brain Executor → Service Calls

- `executeUpdateLead` → `leadService.update(...)`
- `executeListLeads` → `leadService.list(...)`
- Same for proposals, delivery, proof, signals.
- Executor imports services; no route calls.

### 4. Break Circular Dependency

- `brain/executor` imports `agents/runner` for `delegate_to_agent` only.
- `agents/runner` uses same executor for tool execution.
- Options: (a) Extract shared tool execution into `lib/tools/executor.ts` used by both; (b) Agents call executor; executor delegates to runner for `delegate_to_agent` only (current). Document the dependency; ensure no cycle (executor → runner → executor would be a cycle; verify current flow).

### 5. Heavy Route Extraction

- `POST /api/leads/[id]/promote` → `leadService.promote(id, input)`
- `POST /api/proposals/[id]/mark-won` → `proposalService.markWon(id, input)`
- `POST /api/delivery-projects/[id]/complete` → `deliveryService.complete(id, input)`
- `POST /api/flywheel/simulate` → extract to `flywheelService.simulate(input)`
- `GET /api/internal/founder/summary` → extract to `founderService.getSummary(entityType, entityId)`

## File Changes (High Level)

| Action | File |
|--------|------|
| Create | `src/lib/services/lead-service.ts` |
| Create | `src/lib/services/proposal-service.ts` |
| Create | `src/lib/services/delivery-service.ts` |
| Create | `src/lib/services/proof-service.ts` |
| Create | `src/lib/services/signal-service.ts` |
| Create | `src/lib/services/score-service.ts` |
| Create | `src/lib/services/risk-service.ts` |
| Create | `src/lib/services/nba-service.ts` |
| Modify | `src/lib/copilot/coach-tools.ts` — use services instead of fetch |
| Modify | `src/lib/brain/executor.ts` — use services for CRUD tools |
| Modify | Route handlers — thin wrappers calling services |

## Order of Execution

1. **Score, Risk, NBA services** — Highest impact for coach-tools. Extract from existing route logic.
2. **Coach-tools refactor** — Switch to service calls. Remove HTTP.
3. **Lead, Proposal, Delivery services** — Extract from routes + executor.
4. **Brain executor refactor** — Use services.
5. **Proof, Signal services** — Lower priority.
6. **Circular dependency** — Audit and document; fix if needed.

## Consequences

- Routes become thin; business logic testable in isolation.
- Coach mode no longer incurs HTTP round-trips to self.
- Single source of truth for domain operations.
- Migration is incremental; can be done service-by-service.
