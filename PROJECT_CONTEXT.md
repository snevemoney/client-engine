# PROJECT_CONTEXT — Client Engine (Single Source of Truth)

**For full system purpose, mental model, and non-negotiables:** read **SYSTEM_MANIFEST.md** first. This file is the implementation and “what’s built / what’s next” truth.

## Goal
Build a lead → proposal → build pipeline with hard gates so money path is safe:
ACCEPT → PROPOSE → BUILD. Nothing ships unless explicitly allowed.

**Baseline updated.** main = deployable truth (auth/schema/API hardening, health, retry, dry-run, error classifier, E2E scaffold).

## What is already implemented (confirmed)
### Money Path Locks
- Lead status: `LeadStatus` (NEW, ENRICHED, SCORED, APPROVED, REJECTED, BUILDING, SHIPPED).
- Propose: requires positioning artifact (POSITIONING_BRIEF); shared `buildProposalPrompt`; pipeline + manual both use `runPropose`.
- Build API: server-side gate — requires `lead.status === "APPROVED"`, at least one proposal artifact, and no existing project; else 403 with requiredStatus/currentStatus or "No proposal artifact" message.
- Error classifier: step failure notes use codes (OPENAI_429, GATE, VALIDATION, etc.) via `formatStepFailureNotes` in orchestrator and all step routes.

### Proposal Console
Route: `/dashboard/proposals/[id]`
- Parses proposal markdown into sections:
  - Opening
  - Upwork Snippet
  - Questions Before Starting
- One-click copy per section and full proposal
- Upwork snippet char counter (X/600; amber if >600)
- Toggles:
  - Ready to send
  - Sent on Upwork (freezes proposal; badge + disables ready toggle)
PATCH: `/api/artifacts/[id]`

### Cursor Execution Contract
Each build creates artifact: `CURSOR_RULES.md`
- Cursor may scaffold/refactor/ship demos
- Cursor must not contact clients, change pricing logic, or delete projects

### Step 3 Email Ingestion (Source #1)
File: `src/workers/email-ingestion.ts`
- LeadSource slug: `email-inbox` auto-created if IMAP env exists
- Respects LeadSource.enabled and LeadSource.rateLimit
- Each run creates LeadSourceRun (running → ok/error, finishedAt, eventsCount, errorLog)
- Each email creates LeadSourceEvent with rawId + payload JSON
- Dedup then create Lead, set event.leadId
- No db disconnect; uses shared db from `@/lib/db`
GET `/api/sources` auto-creates source if IMAP env is set

### Positioning Engine (post-enrich, pre-propose)
- New artifact type: `positioning` title `POSITIONING_BRIEF`
- Created by `runPositioning` in pipeline
- Propose requires positioning artifact; manual propose will run positioning if missing
- Proposal prompt uses positioning-first opening (problem/outcome, not feature-first)

## Known issue / TODO
### DB migrations not applied (postgres unreachable at postgres:5432)
When DB is up:
cd client-engine && npx prisma migrate dev --name add_verdict_and_proposal_flags
(Or prisma db push if not using migrations)

### Env keys
- OPENAI_API_KEY must be in server `.env`
- CAPTURE_API_KEY must be set via env for URL capture endpoint

## What we are building next (current phase)
Step 4 automation is in place:
- **Orchestrator:** `src/lib/pipeline/orchestrator.ts` — `runPipelineIfEligible(leadId, reason)` with advisory lock, idempotent steps (Enrich → Score → Position → Propose). Build is not run by the orchestrator (manual only).
- **Triggers:** Email ingestion calls orchestrator after creating a lead; POST /api/leads fires pipeline (async) after manual lead create.
- **Manual run:** POST /api/pipeline/run/[leadId] for re-run pipeline (admin auth).
- **Position step:** `runPositioning(leadId)` in `src/lib/pipeline/positioning.ts`; POST /api/position/[id] with metrics.
- **Lock:** Postgres advisory lock in `src/lib/db-lock.ts` to prevent concurrent runs per lead.
- **Step logic:** Shared in `src/lib/pipeline/enrich.ts`, `score.ts`, `propose.ts`, `positioning.ts`; API routes and orchestrator use them.
Hard gates remain in place.

## Metrics + Evaluation layer (implemented)
- **DB:** `PipelineRun` (leadId, status, startedAt, finishedAt, success, error), `PipelineStepRun` (runId, stepName, startedAt, finishedAt, success, tokensUsed, costEstimate, outputArtifactIds, notes).
- **Artifact:** Each finished run creates `RUN_REPORT.md` (run id, lead, status, duration, steps with success/tokens/duration/notes).
- **Logging:** Enrich, Score, Propose, Build APIs create a run, start a step, and on success/failure call `finishStep` + `finishRun` (no change to money-path gates).
- **Dashboard:** `/dashboard/metrics` — step success counts (enrich/score/propose/build), recent runs table with lead link, status, startedAt.

## Current unknowns
- Which steps actually "work" (macro vs micro): use Metrics page and RUN_REPORT artifacts to inspect.
- Per-step quality (positioning clarity, proposal length, snippet chars, verdict distribution) can be added next.

---

## Phases & roadmap (canonical map)

### Phases completed

- **Phase 0 — Baseline + context:** PROJECT_CONTEXT.md + SYSTEM_MANIFEST.md; “read context first” for Cursor; baseline on main.
- **Phase 1 — Metrics:** PipelineRun, PipelineStepRun, pipeline-metrics.ts, RUN_REPORT, /dashboard/metrics.
- **Phase 2 — Positioning:** runPositioning, artifact type `positioning` title POSITIONING_BRIEF, gate “Propose requires positioning”, orchestrator order Enrich → Score → Position → Propose.
- **Phase 3 — Safety hardening:** Build gate (APPROVED + proposal artifact + no project); error classifier + step notes; idempotent steps; single entrypoint runPipelineIfEligible used by all triggers.

**Result:** Coherent pipeline core with observability, positioning gate, and money-path gates.

### Phases intentionally skipped (deferred)

- **Skip A — Positioning meta validation:** No Zod schema for POSITIONING_BRIEF; today LLM output is stored as-is.
- **Skip B — Rate limiting:** Auth only; no per-route throttling.
- **Skip C — Artifact provenance:** No promptVersion, model, pipelineRunId, stepName on artifacts.
- **Skip D — Retries:** No retryCount or auto-retry for retryable errors (e.g. OPENAI_429).
- **Skip E — Migrations:** Using db push; no prisma/migrations history yet.

### Phase we’re in now: Phase 4 — E2E confidence + production readiness

Focus: repeatable green E2E (local + VPS), minimal ops scaffolding, predictable triggers.

**Done so far:** Health endpoint, dry-run E2E, env hardening (AUTH_SECRET, NEXTAUTH_URL, Playwright cwd/env).

**Phase 4 ends when:** /api/health green on prod; login works (no redirect loop); create lead → run + steps on /dashboard/metrics; dry-run E2E passes locally.

### What’s next (recommended order)

1. **Positioning contract + validation** — Zod schema for positioning; validate before save; VALIDATION failure + NEEDS_REVIEW if invalid. (Quality.)
2. **Retry policy** — Use error codes: OPENAI_429/5XX/NETWORK = retryable; add retryCount and optional nextRetryAt. (Uptime.)
3. **Rate limiting** — Protect /api/pipeline/*, /api/propose/*, /api/position/*, /api/build/*. (Safety.)
4. **Artifact provenance** — pipelineRunId, stepName, model, promptVersion (or equivalent) on artifacts. (Debuggability.)
5. **Migrations** — Switch from db push to prisma migrate once prod data matters.

### Next 3 commits (choose one track)

**Quality-first**

1. Add Zod schema for positioning brief content/meta; validate in runPositioning before db.artifact.create; on failure call finishStep with VALIDATION and throw.
2. Add optional meta field or JSON column on Artifact; write pipelineRunId, stepName, model in positioning + propose + build steps.
3. Document the positioning contract in PROJECT_CONTEXT (expected shape, validation rules).

**Uptime-first**

1. Add retryCount (and optionally lastErrorCode) to PipelineRun or step notes; in orchestrator catch, if classifyPipelineError returns retryable, increment and re-throw or schedule retry instead of finishRun(false).
2. Add simple rate limit (in-memory or DB) for POST /api/pipeline/*, /api/propose/*, /api/position/*, /api/build/*; 429 with Retry-After when over limit.
3. Add nextRetryAt or “retry this run” manual action that re-calls runPipelineIfEligible for the same lead with reason "retry".

---

**Cursor:** Read this file first in new chats. Treat it as the single source of truth.
