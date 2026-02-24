# PROJECT_CONTEXT — Client Engine (Single Source of Truth)

**For behavioral law (who we serve, what’s forbidden, AI role, proposal/proof rules):** read **docs/CLIENT_ENGINE_AXIOMS.md** first. Do not propose or generate anything that violates it.

**For full system purpose and mental model:** read **SYSTEM_MANIFEST.md**. This file is the implementation and “what’s built / what’s next” truth.

## Goal

Build a lead → proposal → build pipeline with hard gates so money path is safe:
ACCEPT → PROPOSE → BUILD. Nothing ships unless explicitly allowed.

**Positioning (1-line):** *I build custom operator apps that make business operations cleaner and faster — lead flow, proposals, proofs, Meta ads in one system. Build-and-leave.* — See [docs/OPERATOR_FRAMEWORK.md](docs/OPERATOR_FRAMEWORK.md) for full framework.

**Baseline:** main = deployable truth (auth, schema, API hardening, health, retry, dry-run, error classifier, E2E scaffold).

---

## 1. What ships now (client-engine-1 — “Money Path Machine”)

This is the production slice: turn inbound leads into positioning → proposals → approved builds, with hard gates and metrics.

### A) Core product behavior

- **Lead lifecycle:** status-driven (NEW → ENRICHED → SCORED → APPROVED/REJECTED → BUILDING → SHIPPED); money-path locked.
- **Leads** exist in DB; pipeline runs automatically or manually.
- **Owner approval** required before Build can happen.
- **Artifacts:** everything important is saved as an Artifact (enrichment, score, **POSITIONING_BRIEF**, proposal, **RUN_REPORT.md** per run, plus optional email/source snapshots).

### B) Database + schema (Prisma/Postgres)

- **Lead:** statuses (incl. APPROVED gating Build), outcome fields (proposalSentAt, approvedAt, buildStartedAt, buildCompletedAt, dealOutcome), relation to artifacts + pipelineRuns.
- **Artifact:** stores pipeline outputs and reports (type, title, content, meta).
- **Project:** created only by Build (and only after approval + proposal).
- **PipelineRun:** status, timing, success/error, retryCount, lastErrorCode, lastErrorAt.
- **PipelineStepRun:** stepName, timings, success, tokensUsed, costEstimate, outputArtifactIds, notes (machine-friendly error prefix).

### C) Pipeline + orchestration

- **Single entrypoint:** `runPipelineIfEligible(leadId, reason)` — `src/lib/pipeline/runPipeline.ts` (re-exports orchestrator).
- **Step order:** Enrich → Score → Position → Propose. Build is manual only (not in orchestrator).
- **Idempotency:** if the correct artifact already exists, the step is skipped (no duplicates).
- **Concurrency:** advisory lock (`src/lib/db-lock.ts`) to prevent two pipelines on the same lead at once.
- **Hard gates:** Propose requires POSITIONING_BRIEF; Build requires `lead.status === "APPROVED"`, a proposal artifact, and no existing project.
- **Retries:** Run tracks retryCount; retryable errors (OPENAI_429, OPENAI_5XX, OPENAI_NETWORK) increment retryCount; non-retryable still write lastErrorCode/lastErrorAt. Manual retry endpoint returns details when it doesn’t run.

### D) Error classification

- **`src/lib/pipeline/error-classifier.ts`:** codes OPENAI_429, OPENAI_5XX, OPENAI_4XX, OPENAI_NETWORK, GATE, VALIDATION, DB, UNKNOWN. Failures stored as `CODE|message...` in step notes (consistent, searchable).

### E) Metrics + evaluation

- Every run creates PipelineRun + PipelineStepRun per step; **RUN_REPORT.md** artifact per run (retry info, last failed step, truncated notes).
- **UI:** `/dashboard/metrics` — step success counts + recent runs table.

### F) Proposal engines (positioning-first)

- **Positioning:** produces POSITIONING_BRIEF (felt problem, language map, reframed offer, blue ocean angle, packaging). `runPositioning` in `src/lib/pipeline/positioning.ts`.
- **Proposal generator** uses positioning brief (felt problem/hook, why now, proof bullets). Revise loop: endpoint + UI to regenerate proposal from instruction while keeping positioning.
- **Proposal console:** `/dashboard/proposals/[id]` — sections (Opening, Upwork Snippet, Questions), copy, char counter (X/600), Ready to send / Sent on Upwork toggles. PATCH `/api/artifacts/[id]`.

### F2) Quiet Proof Engine (QPE) + Checklist Engine

- **Proof posts:** Daily proof posts generated from real pipeline artifacts (research/enrich/score/position/proposal/outcome). Format: what I saw → cost → what I changed → result → quiet CTA (“comment CHECKLIST”). No hype, no invented numbers; cost from PipelineStepRun only (“approx” or “not measured”).
- **API:** POST `/api/proof/generate` (body: `{ leadId }`) creates a `proof_post` artifact on the lead; GET `/api/proof` lists recent proof posts. Artifact meta: leadId, artifactIds, totalCostApprox, generatedAt, optional keywords.
- **Checklist:** Reusable checklist artifact (system cleanup / tool reduction / workflow simplification) tied to the offer. POST `/api/checklist/generate` (optional keywords, requestSource, proofPostArtifactId) creates a `checklist` artifact on the system lead “Proof & Checklist Engine”. No auto-DM, no auto-email; display in UI only.
- **UI:** `/dashboard/proof` — select lead, generate proof post, copy, list recent proof posts. `/dashboard/checklist` — request checklist (optional keywords), copy, list recent checklists.
- **Tracking:** Proof and checklist artifacts store meta (keywords, requestSource, proofPostArtifactId) for later analysis; no new tables.
- **Runbook:** How to generate a proof post in the dashboard → **docs/runbook-proof-post.md**.

### G) Approve / Reject + outcome tracking

- **API:** POST `/api/leads/[id]/approve`, POST `/api/leads/[id]/reject`; proposal-sent and deal-outcome endpoints. Lead detail UI: Approve/Reject controls, artifacts summary, mark proposal sent, mark deal won/lost.
- **Lead fields:** proposalSentAt, approvedAt, buildStartedAt, buildCompletedAt, dealOutcome (won/lost). Only dedicated routes set these; PATCH lead is allowlisted (no status/outcome fields).

### H) Triggers

- **Auto:** pipeline runs on lead creation and on email ingestion (when it creates a lead).
- **Manual:** manual pipeline run, retry pipeline run (POST `/api/pipeline/run`, `/api/pipeline/retry/[leadId]`).

### I) Auth / security

- NextAuth credentials auth; AUTH_SECRET, NEXTAUTH_URL; trustHost for proxy. Dev: reset-auth script, optional AUTH_DEV_PASSWORD (dev only). Most expensive endpoints require auth.

### J) Health + deploy

- **GET /api/health:** DB connectivity, pipeline tables exist, AUTH_SECRET set, NEXTAUTH_URL set. Returns 503 if critical checks fail.

### K) E2E + dry-run

- Playwright test scaffold. **Dry-run:** `PIPELINE_DRY_RUN=1` (or E2E mode) creates placeholder artifacts without OpenAI; tests can pass without OPENAI_API_KEY.

### L) Optional (only if you run them)

- Redis worker/queue; IMAP email ingestion; seed-projects script.

### Build / Cursor contract

- Each build creates **CURSOR_RULES.md** artifact. Cursor may scaffold/refactor/ship demos; must not contact clients, change pricing, or delete projects.

---

## 2. What we’re building next (before production)

### Research Engine R1 — implemented

The “Online Research → Lead Factory → Proposal Drafts” pipeline is **implemented** for zero manual start:

- **Entrypoint:** `runResearchDiscoverAndPipeline({ limit })` in `src/lib/research/run.ts`.
- **Source adapter:** RSS/Atom (`RESEARCH_FEED_URL`). Add more adapters in `src/lib/research/adapters/`.
- **Dedupe:** canonical `sourceUrl`; skip if Lead exists with same sourceUrl.
- **Filter:** low-signal (intern/unpaid/volunteer/equity only) skipped.
- **Lead + RESEARCH_SNAPSHOT** artifact; then `runPipelineIfEligible(leadId, "research_ingested")`.
- **Observability:** RESEARCH_RUN_REPORT artifact per run (counts: discovered, filtered, skippedDedupe, created, errors).
- **Controls:** `RESEARCH_ENABLED=1`, `RESEARCH_LIMIT_PER_RUN=10`; manual run: `POST /api/research/run` (auth or Bearer `RESEARCH_CRON_SECRET`); cron: `npm run research:run` or curl POST with secret.

See **docs/RESEARCH_ENGINE_SPEC.md** §9 for env vars and safety. See **docs/NEXT_R1.md** for 9–5 automation and “10 real clients” definitions.

**Possible next steps (not required for R1):** Upwork API adapter, Discord/email notifications, more sources.

### Quiet Proof Engine (QPE) + Checklist — implemented

- **Proof:** `buildProofPost(leadId)` in `src/lib/proof-engine/generate.ts`; pure line builder in `proof-lines.ts` (no hype, no invented metrics). Dashboard: Proof → pick lead → Generate → copy. Artifacts type `proof_post` on lead; meta tracks artifactIds, totalCostApprox, keywords.
- **Checklist:** `buildChecklistContent()` in `src/lib/proof-engine/checklist.ts`; system lead holds checklist artifacts. Dashboard: Checklist → optional keywords → Generate checklist → copy. When someone comments “CHECKLIST”, operator can generate and share from dashboard (no auto-send).

**Next (optional):** Keywords from proof post CTA responses; A/B phrasing for CTA line.

### Other recommended (after or alongside)

- Positioning contract + Zod validation; rate limiting on pipeline/position/propose/build; artifact provenance (pipelineRunId, stepName, model); migrations (prisma migrate once prod data matters).

---

## 3. Long-term / out of this repo

Not part of client-engine-1 scope; keep in mind for “where does this live?”:

- **Coach OS / Mastermind:** North Star, daily execution loop, constraint solver, debrief/learning loop, decision hygiene (separate system).
- **Pattern Library / Macro–Micro:** positioning frames, offer archetypes, hooks/CTAs, experiment engine, pattern promotion (winners/losers) — “we don’t know what works” loop.
- **Marketing brain expansion:** Offer Engineering, Hook/Angle Generator, Campaign builder, Objection handling, Proof engine (positioning is the gate; marketing is a suite).
- **Build automation (beyond gate):** project scaffolding, deployment pipelines, versioning/rollback, status reporting.
- **AgentPilot:** schema registry, agent importer/validation, MCP tools, orchestration nodes, Python bridge — platform-level.
- **BitBrain:** SentiBit, BitBalance Optimizer, etc. — separate product direction.

---

## 4. Out of scope for this sprint

Do not implement in client-engine-1 unless explicitly requested for this sprint:

- Coach OS / forever mastermind layer.
- Pattern library, A/B experiments, macro-micro learning.
- Full marketing suite beyond positioning + proposal.
- AgentPilot schema/orchestration/RAG.
- BitBrain tool suite.
- Auto-send proposals or auto-build without approval.

---

## 5. Pre-production checklist

Before deploy to production, ensure:

- VPS env has: **DATABASE_URL**, **AUTH_SECRET**, **NEXTAUTH_URL**, plus any worker vars you use.
- **prisma db push** (or migrations) applied on VPS.
- **GET /api/health** returns `ok: true`.
- Auto trigger paths run on server (lead_created, email_ingested; research_ingested when Research pipeline is added).
- Build gate verified: APPROVED + proposal artifact required; no build without both.

---

## Phases & roadmap (canonical map)

### Phases completed

- **Phase 0 — Baseline + context:** PROJECT_CONTEXT + SYSTEM_MANIFEST; “read context first” for Cursor.
- **Phase 1 — Metrics:** PipelineRun, PipelineStepRun, pipeline-metrics.ts, RUN_REPORT, /dashboard/metrics.
- **Phase 2 — Positioning:** runPositioning, artifact type `positioning` title POSITIONING_BRIEF, gate “Propose requires positioning”, order Enrich → Score → Position → Propose.
- **Phase 3 — Safety hardening:** Build gate (APPROVED + proposal + no project); error classifier + step notes; idempotent steps; single entrypoint runPipelineIfEligible.
- **Phase 4 — Retries + E2E:** retryCount, lastErrorCode, lastErrorAt on PipelineRun; classifyPipelineError + retryable vs non-retryable; manual retry endpoint; health endpoint; dry-run E2E; env hardening.

### Phases deferred (not skipped forever)

- **Skip A — Positioning meta validation:** No Zod schema for POSITIONING_BRIEF yet; LLM output stored as-is.
- **Skip B — Rate limiting:** Auth only; no per-route throttling.
- **Skip C — Artifact provenance:** No promptVersion, model, pipelineRunId, stepName on artifacts yet.
- **Skip E — Migrations:** Using db push; no prisma/migrations history yet.

### Phase we’re in now: Phase 5 — Research → Lead Factory + production readiness

- **Focus:** “Online Research → Lead Factory → Proposal Drafts” pipeline (source discovery, fetch/extract, dedupe+filter, lead factory bridge, scheduler, notifications). Plus: /api/health green on prod, login works, create lead → run + steps on metrics, dry-run E2E passes.

### Later (recommended order)

1. Positioning contract + Zod validation.
2. Rate limiting on pipeline/position/propose/build.
3. Artifact provenance (pipelineRunId, stepName, model).
4. Migrations when prod data matters.

---

## Cursor Next Actions

**When the user says “use the browser”** → Use the **Cursor side-panel browser** (MCP: `cursor-ide-browser`). Do not use Playwright for that; Playwright is for CI/headless only unless the user explicitly asks for it.

### Safety + realism (done)

- **PATCH /api/leads/[id]:** Allowlist only (title, source, sourceUrl, description, budget, timeline, platform, techStack, contactName, contactEmail, tags). status, approvedAt, buildStartedAt, proposalSentAt, dealOutcome → 400 "Field not allowed"; set only via dedicated routes.
- **AUTH_DEV_PASSWORD:** Dev only; ignored in production with warning.
- **Outcome tracking:** approvedAt (approve), buildStartedAt/buildCompletedAt (build), proposalSentAt (proposal-sent), dealOutcome (deal-outcome).

### Phase 6 “money leverage” (later)

- Revise proposal UX polish (artifact history, Set as primary, copy positioning + proposal).
- Send proposal integration (mailto or Gmail SMTP → auto-call proposal-sent).

**Definition of “Phase 6 done”:** Flow create lead → pipeline → review positioning/proposal → revise → approve → build → mark proposal sent → mark deal outcome; metrics show runs, failures, retry metadata, conversion timestamps.

---

## Known issues / Env

- **DB:** When DB is up, use `npx prisma migrate dev` or `prisma db push` as appropriate.
- **Env keys:** OPENAI_API_KEY in server `.env`; CAPTURE_API_KEY for URL capture if used.

---

**Cursor:** Read this file first in new chats. Treat it as the single source of truth for what ships now, what’s next, and what’s out of scope.
