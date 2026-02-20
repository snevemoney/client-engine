# PROJECT_CONTEXT — Client Engine (Single Source of Truth)

**For full system purpose, mental model, and non-negotiables:** read **SYSTEM_MANIFEST.md** first. This file is the implementation and “what’s built / what’s next” truth.

## Goal
Build a lead → proposal → build pipeline with hard gates so money path is safe:
ACCEPT → PROPOSE → BUILD. Nothing ships unless explicitly allowed.

## What is already implemented (confirmed)
### Money Path Locks
- Prisma schema: `Lead.verdict` enum: ACCEPT | MAYBE | REJECT
- Artifact flags: `Artifact.proposalReady` (bool), `Artifact.proposalSentAt` (datetime)
- Score API: reads LLM verdict, stores to `Lead.verdict`
- Propose API: only runs if lead is SCORED or APPROVED AND verdict in (ACCEPT, MAYBE); else 400
- Build API: only runs if verdict === ACCEPT OR status === APPROVED AND at least one proposal artifact exists; else 400 with clear message

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

**Cursor:** Read this file first in new chats. Treat it as the single source of truth.
