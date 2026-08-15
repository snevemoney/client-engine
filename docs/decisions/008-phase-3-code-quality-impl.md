# Implementation Plan: Phase 3 — Code Quality

## Status: Proposed

## Goal

Improve maintainability, consistency, and type safety across the codebase. Incremental work; each item can be a separate PR.

## Scope

1. Create shared follow-up service (deduplicate intake/proposal/delivery patterns)
2. Centralize env var access (META_AD_ACCOUNT_ID, OPENAI_API_KEY)
3. Extract agent prompts from registry into separate .md files
4. Standardize error types (AppError, NotFoundError, ValidationError)
5. Fix type safety issues (as never, as any, 55 files with JSON casts)
6. Clean up magic numbers into constants
7. Consolidate cron auth pattern

## 1. Shared Follow-Up Service

**Problem:** Intake, proposal, and delivery domains have similar follow-up logic (schedule, snooze, dismiss, next follow-up). Duplicated patterns.

**Approach:**

- Create `src/lib/follow-ups/service.ts`:
  - `scheduleFollowUp(entityType, entityId, scheduledFor, options)`
  - `snoozeFollowUp(entityType, entityId, duration)`
  - `dismissFollowUp(entityType, entityId)`
  - `getNextFollowUp(entityType, entityId)`
- Entity types: `intake_lead`, `proposal`, `delivery_project`, `deal`
- Unify Cadence, NextBestAction, and domain-specific scheduling into one abstraction where possible.
- Routes and NBA system call the service.

**Files to analyze:** `src/lib/next-actions/`, `src/lib/cadence/`, intake/proposal/delivery follow-up routes.

## 2. Env Var Centralization

**Problem:** `process.env.META_AD_ACCOUNT_ID`, `process.env.OPENAI_API_KEY`, etc. scattered across 50+ files. No validation, no single source of truth.

**Approach:**

- Create `src/lib/env.ts`:
  - `getEnv(key: EnvKey): string | undefined`
  - `requireEnv(key: EnvKey): string` — throws if missing (for required vars at startup)
  - Typed `EnvKey` union for known vars
  - Optional: Zod schema for validation at app init
- Migrate high-traffic vars first: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `META_AD_ACCOUNT_ID`, `META_ACCESS_TOKEN`, `DATABASE_URL`, `BUILDER_API_URL`, `ENRICH_CONTEXT_SECRET`.
- Document in `.env.example` and `docs/generated/env-vars.md`.

## 3. Agent Prompts in .md Files

**Problem:** Agent system prompts live in `src/lib/agents/registry.ts` as template literals. Hard to edit, no versioning, mixed with config.

**Approach:**

- Create `src/lib/agents/prompts/` or `docs/agents/prompts/`:
  - One file per agent: `commander.md`, `signal_scout.md`, `outreach_writer.md`, etc.
- Registry imports or reads at build time.
- Registry keeps: agentId, schedule, toolAllowlist, systemPrompt (loaded from file).

## 4. Standardize Error Types

**Problem:** Routes return `jsonError(message, status)` inconsistently. No structured error types.

**Approach:**

- Create `src/lib/errors.ts`:
  - `AppError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`
- `jsonError` accepts `AppError` or `(message, status)`.
- Services throw typed errors; routes catch and return appropriate status.
- Gradual migration.

## 5. Fix Type Safety

**Problem:** 55+ files with `as never`, `as any`, JSON casts.

**Approach:**

- Audit with grep for `as any`, `as never`.
- Prioritize: `req.json()` with Zod, Prisma result types, artifact meta types.
- Create shared types in `src/lib/types/` for common shapes.
- Fix incrementally per domain.

## 6. Magic Numbers to Constants

**Problem:** Hardcoded values for timeouts, limits, pagination.

**Approach:**

- Create `src/lib/constants.ts`:
  - `PAGINATION_DEFAULT_PAGE_SIZE`, `AGENT_APPROVAL_EXPIRY_HOURS`, etc.
- Replace magic numbers with named constants.

## 7. Consolidate Cron Auth Pattern

**Problem:** Multiple routes check Bearer token with different env vars.

**Approach:**

- Create `src/lib/auth/cron.ts`:
  - `requireCronAuth(req, allowedSecrets: string[])` — returns 401 if no valid Bearer
- Migrate health, agents/cron, research/run, enrich-context to use shared helper.

## Order of Execution

1. Shared follow-up service — High impact.
2. Cron auth consolidation — Small, reduces duplication.
3. Env var centralization — Foundation.
4. Magic numbers to constants — Quick wins.
5. Agent prompts in .md — Improves editability.
6. Error types — Incremental.
7. Type safety — Ongoing.
