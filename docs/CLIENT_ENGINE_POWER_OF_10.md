# CLIENT ENGINE POWER OF 10 (RELIABILITY LAW)

**Every AI and human contributor must not violate these laws when adding or modifying Tier-A paths.**

Complements [CLIENT_ENGINE_AXIOMS.md](CLIENT_ENGINE_AXIOMS.md) (behavioral contract) and [API_CONTRACTS.md](API_CONTRACTS.md) (response shapes). This document governs reliability and structure.

---

## The 10 Laws

### 1. No Silent Failures on Tier-A Routes

Tier-A routes must never swallow errors or return success when data is partial or wrong. Fallbacks must set `degraded: true` and log an ops event. Auth infrastructure failures must log `auth.infrastructure_error`.

**Current state:** Aligned. Founder summary, requireAuth, API_CONTRACTS enforce this. Growth summary does not yet return degraded (computeGrowthSummary has no fallback path).

**References:** [API_CONTRACTS.md](API_CONTRACTS.md) (degraded shape), `src/lib/api-utils.ts` (requireAuth ops event).

---

### 2. Every Mutation Must Be Idempotent or Deduped

POST/PATCH/DELETE that create or update state must use `dedupeKey`, advisory locks, or upsert semantics so duplicate requests do not create duplicate side effects.

**Current state:** Strongly aligned. Pipeline uses advisory locks (`src/lib/pipeline/orchestrator.ts`); jobs use `dedupeKey` (`src/lib/jobs/types.ts`); NBA upserts by dedupeKey (`src/lib/next-actions/service.ts`); agents dedupe by run key (`src/lib/agents/runner.ts`); scoring, notifications, and reminders all use dedupe patterns.

**References:** [BOUNDED_CONTEXTS.md](BOUNDED_CONTEXTS.md) (Lead Intake: advisory locks), `src/lib/db-lock.ts`.

---

### 3. Every Tier-A Page Must Render Degraded/Error States

Dashboard pages that consume Tier-A APIs must render `DegradedBanner` when `degraded === true` and use `AsyncState` for loading/error. No page may show empty data that looks healthy when the API failed.

**Current state:** Partial. Founder and Growth have DegradedBanner. Command center, scoreboard, next-actions, copilot, delivery, leads, proposals do not yet.

**References:** `src/components/ui/DegradedBanner.tsx`, [API_CONTRACTS.md](API_CONTRACTS.md).

---

### 4. Every Route Must Have Contract Tests

Every API route must have unit tests covering: 401, 200 shape, 500 with sanitized error (no secrets in response). Tier-A routes must have full coverage per the [API_CONTRACTS.md](API_CONTRACTS.md) test checklist.

**Current state:** Partial. Growth routes (deals, prospects, summary) have 15 tests. ~15 routes still missing 500 sanitization tests; some missing 401.

**References:** [API_CONTRACTS.md](API_CONTRACTS.md) (Test Contract Checklist), [GROWTH_GOLDEN_SCENARIOS.md](GROWTH_GOLDEN_SCENARIOS.md) (test coverage matrix).

---

### 5. Every New Domain Must Declare Bounded Context

Before adding a new domain (models + routes + services + pages), add an entry to [BOUNDED_CONTEXTS.md](BOUNDED_CONTEXTS.md) with models, routes, services, pages, and invariants. No orphan domains.

**Current state:** Aligned. 9 contexts documented. New domains must follow this before writing code.

**References:** [BOUNDED_CONTEXTS.md](BOUNDED_CONTEXTS.md).

---

### 6. Every Background Process Must Log Before/After/Result

Cron handlers, job workers, and flywheel hooks must log at start (what is running, key params), at end (success/failure, duration), and on error (sanitized). Use `logOpsEventSafe`.

**Current state:** Partial. Many handlers use `logOpsEventSafe` (agents/cron, memory ingest, brain executor, risk, NBA run). Not all follow a strict before/after/result pattern; some only log on error.

**References:** `src/lib/ops-events/log.ts`, `src/app/api/agents/cron/route.ts`.

---

### 7. Every Deploy Must Use migrate deploy

Production deploys must run `prisma migrate deploy`. Never `db push` or `db push --accept-data-loss` in production. Local dev may use `db push` or `migrate dev`.

**Current state:** Aligned. `deploy.sh` uses `migrate deploy`. ADR-003 superseded.

**References:** [RELEASE_DISCIPLINE.md](RELEASE_DISCIPLINE.md), [decisions/003-prisma-db-push.md](decisions/003-prisma-db-push.md).

---

### 8. Every AI Action Must Have Scope, Limits, and Audit Trail

Brain tool calls and agent runs must have:
- **Scope:** entityType, entityId, userId
- **Limits:** token cap, tool call cap, concurrency cap
- **Audit trail:** AgentRun record, CopilotActionLog, tool call records

Write tools require approval in agent mode.

**Current state:** Aligned. Agents: AGENT_LIMITS (50k tokens, 15 tool calls, 2 concurrent), dedupeKey, AgentRun record, toolCallsJson. Brain: ToolContext (userId, entityType, entityId), CopilotActionLog. Write tools require approval gate.

**References:** `src/lib/agents/types.ts` (AGENT_LIMITS), `src/lib/brain/executor.ts`, [AI_STACK_DOCTRINE.md](AI_STACK_DOCTRINE.md).

---

### 9. No Giant Mixed-Responsibility Files in Tier-A Paths

Files in `src/app/api/internal/*`, `src/app/dashboard/*`, `src/lib/brain/*`, `src/lib/agents/*` should not exceed ~500 lines. Split by responsibility: data fetch vs. UI vs. handlers. Mixed concerns must be refactored before adding features.

**Current state:** Weak. Several 1000+ line files:
- `leads/[id]/page.tsx` (1196 lines)
- `delivery/[id]/page.tsx` (1051 lines)
- `intake/[id]/page.tsx` (1021 lines)
- `brain/executor.ts` (830 lines)

This is the main gap for strict simplicity and size discipline.

**References:** This law establishes the rule. No prior doc exists.

---

### 10. No New Platform Domains Before Passing Reliability Gate

Do not add a new bounded context (new domain with models, routes, services, pages) until the current system passes the [PHASE_8_GO_NO_GO.md](PHASE_8_GO_NO_GO.md) gate. Expand existing domains only when reliability is green.

**Current state:** Aligned. Phase 8.0 complete. Gate doc exists. New domains blocked until explicit pass.

**References:** [PHASE_8_GO_NO_GO.md](PHASE_8_GO_NO_GO.md).

---

## Alignment Summary

| Law | Status | Notes |
|-----|--------|-------|
| 1. No silent failures | Aligned | Degraded mode + ops events |
| 2. Idempotent mutations | Aligned | dedupeKey, advisory locks, upserts |
| 3. Degraded UI states | Partial | Founder + Growth only |
| 4. Contract tests | Partial | Growth done; ~15 routes gap |
| 5. Bounded contexts | Aligned | 9 contexts documented |
| 6. Background logging | Partial | Many log; not all before/after |
| 7. migrate deploy | Aligned | deploy.sh enforces |
| 8. AI scope/limits/audit | Aligned | AGENT_LIMITS, ToolContext, approval gates |
| 9. File size discipline | Weak | 4 files over 1000 lines |
| 10. Reliability gate | Aligned | Phase 8.0 gate doc exists |

**Current: ~6/10 aligned with the spirit.** Laws 3, 4, 6, 9 are the remaining gaps. With targeted hardening: 8/10.

---

## How to Use This

**Before writing code:** Check which law applies. If your change touches a Tier-A path, all 10 laws apply.

**Before adding a domain:** Law 5 (declare context) and Law 10 (pass reliability gate) are prerequisites.

**Before deploying:** Law 7 (migrate deploy) and Law 4 (contract tests pass) are prerequisites.

**During code review:** Laws 1, 3, 6, 8, 9 are the most commonly violated. Check them explicitly.

---

## See Also

- [CLIENT_ENGINE_AXIOMS.md](CLIENT_ENGINE_AXIOMS.md) — behavioral contract (what we do and do not do)
- [API_CONTRACTS.md](API_CONTRACTS.md) — response shapes, error shapes, header policies
- [BOUNDED_CONTEXTS.md](BOUNDED_CONTEXTS.md) — domain ownership map
- [AI_STACK_DOCTRINE.md](AI_STACK_DOCTRINE.md) — four-layer AI hierarchy
- [PHASE_8_GO_NO_GO.md](PHASE_8_GO_NO_GO.md) — release readiness gate
- [RELEASE_DISCIPLINE.md](RELEASE_DISCIPLINE.md) — deploy flow and env truth
- [GROWTH_GOLDEN_SCENARIOS.md](GROWTH_GOLDEN_SCENARIOS.md) — revenue-critical test scenarios
