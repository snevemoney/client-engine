# Implementation Plan: Phase 4 — Route Consolidation

## Status: Proposed

## Goal

Extract delivery project route handlers into a service layer, normalize API namespaces, and merge duplicate endpoints. Depends on Phase 2 service layer.

## Scope

1. Extract delivery project route handlers into service layer (34+ routes)
2. Normalize /api/internal/ vs /api/ops/ namespaces
3. Merge duplicate summary endpoints

## Current State

### Delivery Project Routes (34+)

Routes under `src/app/api/delivery-projects/` and nested paths:

- CRUD: `[id]/route.ts` (GET, PATCH)
- Lifecycle: `complete`, `request-proof`, `create-proof-candidate`
- Milestones: `milestones/route.ts`, `milestones/[milestoneId]/route.ts`
- Retention: `retention/status`, `retention/schedule`, `retention/snooze`, `retention/complete`, `retention/log-email`, `retention/log-call`
- Testimonial: `testimonial/request`, `testimonial/receive`
- Review: `review/request`, `review/receive`
- Referral: `referral/request`, `referral/receive`
- Handoff: `handoff/start`, `handoff/complete`
- Client confirm: `client-confirm`
- Checklist: `checklist/toggle`
- Upsell: `upsell`
- Builder: `builder/create`, `builder/regenerate`, `builder/deploy`, `builder/sections`, `builder/feedback`, `builder/versions`, `builder/versions/restore`
- Activity: `activity/route.ts`
- Status: `status/route.ts`

Each route has inline DB logic, validation, and response shaping.

### Namespace Semantics

| Prefix | Current Use | Proposed |
|--------|-------------|----------|
| `/api/internal/` | Dashboard-only, session auth, internal aggregates (scores, founder, growth, retention, copilot) | Keep: operator-facing internal APIs |
| `/api/ops/` | Ops tools: strategy-week, settings, scoreboard, chat, monetization | Keep: ops-specific tools |
| Overlap | Some internal routes feel "ops" (e.g. execution metrics) | Document convention; align by consumer |

**Convention to document:**
- `internal` — Used by dashboard pages, requires session. Aggregates, context, domain summaries.
- `ops` — Used by ops/settings/strategy UI. May overlap; prefer `internal` for domain context, `ops` for configuration/strategy.

### Duplicate Summary Endpoints

Candidates for merge:

- `GET /api/internal/founder/summary` vs founder quarter/week aggregates
- `GET /api/internal/growth/summary` vs `GET /api/internal/growth/context`
- `GET /api/internal/scores/summary` vs scoreboard data
- `GET /api/internal/delivery/context` vs delivery project list/summary

Audit: Map consumers to endpoints; merge where same data is fetched by different paths.

## Implementation Approach

### 1. Delivery Project Service Layer

Create `src/lib/services/delivery-project-service.ts`:

```ts
// Core
create(input): Promise<DeliveryProject>
getById(id): Promise<DeliveryProject | null>
update(id, data): Promise<DeliveryProject>

// Lifecycle
complete(id, input): Promise<DeliveryProject>
requestProof(id, input): Promise<...>
createProofCandidate(id, input): Promise<...>

// Milestones
listMilestones(projectId): Promise<Milestone[]>
updateMilestone(projectId, milestoneId, data): Promise<Milestone>
completeMilestone(projectId, milestoneId): Promise<Milestone>

// Retention
getRetentionStatus(projectId): Promise<RetentionStatus>
scheduleFollowUp(projectId, input): Promise<...>
snoozeRetention(projectId, input): Promise<...>
completeRetention(projectId, input): Promise<...>
logRetentionEmail(projectId, input): Promise<...>
logRetentionCall(projectId, input): Promise<...>

// Testimonial, Review, Referral
requestTestimonial(projectId, input): Promise<...>
receiveTestimonial(projectId, input): Promise<...>
// ... review, referral

// Handoff
startHandoff(projectId, input): Promise<...>
completeHandoff(projectId, input): Promise<...>

// Client confirm, Checklist, Upsell
clientConfirm(projectId): Promise<...>
toggleChecklistItem(projectId, itemId): Promise<...>
recordUpsell(projectId, input): Promise<...>

// Builder (delegate to builder client)
createSite(projectId, input): Promise<...>
regenerateContent(projectId, input): Promise<...>
deploySite(projectId, input): Promise<...>
// ...
```

Routes become:

```ts
// POST /api/delivery-projects/[id]/complete
const result = await requireDeliveryProject(id);
if (!result.ok) return result.response;
const project = await deliveryProjectService.complete(id, await req.json());
return NextResponse.json(project);
```

### 2. Route Migration Order

1. **Low-risk first:** `status`, `activity`, `milestones` — read-heavy, simple.
2. **Lifecycle:** `complete`, `request-proof`, `create-proof-candidate`
3. **Retention:** All retention routes
4. **Testimonial, Review, Referral**
5. **Handoff, Client confirm, Checklist, Upsell**
6. **Builder** — Already uses `builder/client`; service can wrap it.

### 3. Namespace Normalization

- Document in `docs/API_CONTRACTS.md` or `ARCHITECTURE.md`:
  - `/api/internal/*` — Session auth, dashboard consumers, domain context
  - `/api/ops/*` — Ops tools, strategy, settings, scoreboard
- Move misplaced routes if needed (e.g. `execution/metrics` could stay internal — it's dashboard).
- No mass rename unless clear benefit; avoid breaking frontend.

### 4. Merge Duplicate Summaries

- Audit: For each "summary" or "context" endpoint, list consumers and response shape.
- Merge when: Same data, same auth, different paths. Create single source route; deprecate duplicate.
- Example: `growth/summary` and `growth/context` — if context is superset, use context; remove summary or make it alias.

## File Changes (High Level)

| Action | File |
|--------|------|
| Create | `src/lib/services/delivery-project-service.ts` |
| Modify | `src/app/api/delivery-projects/[id]/complete/route.ts` — use service |
| Modify | `src/app/api/delivery-projects/[id]/retention/*` — use service |
| Modify | `src/app/api/delivery-projects/[id]/testimonial/*` — use service |
| Modify | ... (all delivery project routes) |
| Create/Update | `docs/API_NAMESPACES.md` — document internal vs ops |
| Modify | Merge duplicate summary routes per audit |

## Dependencies

- Phase 2 service layer (lead, proposal, etc.) — establishes pattern.
- Phase 3 shared follow-up service — retention scheduling may use it.

## Consequences

- Delivery project logic centralized; easier to test and reason about.
- Routes become thin; consistent pattern across API.
- Namespace clarity improves onboarding.
- Duplicate endpoints removed reduces maintenance.
