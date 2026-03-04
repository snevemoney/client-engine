# Changelog

All notable changes to Client Engine are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Fixed
- Prisma browser error on Leads detail page — extracted `ENRICHMENT_ARTIFACT_TYPE` and `ENRICHMENT_ARTIFACT_TITLE` into `src/lib/pipeline/enrich-constants.ts` so client components can import them without pulling Prisma into the browser bundle
- E2E brain-audit: sidebar test updated for 6 groups (Capture, Convert, Build, Prove, Optimize, System), Full mode toggle, search placeholder "Find a page..."
- E2E ar-panel: strict-mode selectors (`.first()` for unpaid|invoiced, `exact: true` for Paid/Unpaid filter links), DeploysTable always renders filter tabs and table (empty state in tbody when no projects)
- E2E trust-to-close: new lead page redirects to lead detail after create (fixes artifact POST flow; improves UX)
- E2E founder-mode: added `founder-run-next-actions` testid to Execute button; OS hub test expects `founder-os-quarter` and "Quarter"/"Goals and KPI targets"; Save week assertion "Saved" (no period)
- E2E coach-mode: increased session-action-log timeout to 8s

### Added
- `docs/DEPLOY_CHECKLIST_SPRINTS_1_9.md` — deploy checklist for Sprints 1–9 (backup, pre-deploy, migrations, smoke tests, rollback)
- Sprint 9: Outcome Ledger + Scorecard — Outcome model (projectId, actualRevenue cents, repeatClient, referralSource, satisfactionScore 1-5, lessonsLearned); GET/POST/PATCH /api/projects/[id]/outcome; cadence trigger "paid" (7 days after payment) with createCadence on Project paymentStatus → paid; OutcomeEditor in deploys table (expandable for paid projects); ?highlight=projectId on deploys page for cadence deep link; getOutcomeScorecard (win rate by source/score bucket, quoted vs actual, time-to-close); getScoreCalibrationData; /dashboard/scorecard page with tables and ScoreCalibrationChart (scatter: AI score vs actual revenue); Scorecard nav in Prove group
- Sprint 8: Proof Autopublish + Campaign Pages — proof fields on Project (proofPublishedAt, proofHeadline, proofSummary, proofTestimonial, campaignTags); Campaign model (slug, title, filterTag, published, ctaLabel, ctaUrl); generateProofDraft in src/lib/proof/generate.ts (fires when paymentStatus → paid, OpenAI draft with Axioms §8 rules); public /proof/[slug] and /campaigns/[slug] pages; ProofEditor in deploys table (expandable row); Campaign CRUD API (GET/POST /api/campaigns, GET/PATCH/DELETE /api/campaigns/[id]); Campaign manager at /dashboard/campaigns; getProofLinks in src/lib/proof/getProofLinks.ts (scores by tech stack overlap); proof links injected into buildProposalPrompt for pipeline and manual propose
- Sprint 7: Cadence orchestrator — polymorphic Cadence model (sourceType + sourceId for lead, delivery_project, project); createCadence in src/lib/cadence/service.ts; cadence created on SCOPE_SENT (lead status route), on builder deploy (route + worker), on Project paymentStatus → invoiced/partial (PATCH projects); dueAt: +3d scope_sent, +7d deployed, +14d invoiced; processDueCadences in src/lib/cadence/process.ts (sends operator alert, marks completed); POST /api/cadence/process (cron or manual); CadenceDueCard on Command Center (due count + Process button); GET /api/cadence (list by sourceType+sourceId); PATCH /api/cadence/[id] (snooze/resume/complete); CadencesSection on lead detail Sales tab (pause/resume/done)
- Sprint 6: Client portal — public `/portal/[token]` page for clients to view project status, preview/live URLs, and submit feedback; `clientToken` on DeliveryProject (lazy-generated via POST /api/delivery-projects/[id]/portal-token); POST /api/portal/notes for client note submission (DeliveryActivity type client_note); notifyClientPreview and notifyClientDeployed in notify.ts (sent to lead contactEmail when operator deploys or creates builder site); Share portal link button and Client notes section on delivery dashboard; Regenerate from feedback (builder regenerate API accepts optional context, auto-pulls latest client_note activities)
- Sprint 5 Additions: Auto payment follow-up on deploy — notifyDeployComplete() in notify.ts; called from sync deploy route and builder-deploy worker; A/R Panel on Command Center (getCachedARSummary, ARPanelCard); Deploys page payment column and filter tabs (All/Unpaid/Invoiced/Paid); PATCH /api/projects/[id] accepts paymentStatus, paymentAmount, invoicedAt, paidAt; Project model payment fields (paymentStatus, paymentAmount, invoicedAt, paidAt); Playwright deploy-flow.spec.ts and ar-panel.spec.ts
- Sprint 4: Scope negotiation and deal kit — SCOPE_SENT, SCOPE_APPROVED to LeadStatus; build API regeneration path with scope artifacts and HANDOFF_CHECKLIST.md; ChecklistRenderer on lead detail; Regenerate Specs button; email ingestion UID tracking via InternalSetting
- Sprint 3: Channel-aware outreach — proposal prompt and console adapt to lead source (upwork, email, prospect, default); getOutreachSection/getOutreachLabel/getOutreachCharLimit in src/lib/proposals/outreach.ts; sections.ts parses multiple outreach headers (Upwork Snippet, Email Intro, Outreach Message, Pitch); ProposalConsoleEditor shows dynamic label and char limit; artifact API includes lead.source
- Sprint 2: Pipeline visibility and notifications — GET /api/decisions (relaxed artifact filter for MAYBE + positioning-only); /dashboard/decisions page with Approve and Approve & Build actions; notifyNewLead (capture API, email ingestion); notifyDecisionReadyForLead (runPositionStep for MAYBE, runProposeStep for proposal_ready)
- Sprint 1 consistency fixes: ENRICHMENT_ARTIFACT_TYPE constant; standardized enrichment artifact type to "enrichment" (backward compat for "notes"); "Sent on Upwork" → "Sent" label; inline error state in DeliveryChecklist and DeliveryHandoffRetention (replaces alert())

### Changed
- Sprint 4: Build API accepts APPROVED or SCOPE_APPROVED; lead detail status options and build button logic; ImapFlow fetch uses { uid: true } for UID range
- Testing Strategy Gaps: orchestrator.test.ts (10), capture/route.test.ts (8), leads/[id]/route.test.ts (6), leads/route.test.ts (3), propose/[id]/route.test.ts (5), build/[id]/route.test.ts (6), pipeline retry/run route tests (8), ops/settings/route.test.ts (5), positioning.test.ts (5), propose.test.ts (5), email-ingestion.test.ts (14), monitor.test.ts (4)
- Pipeline LLM: ANTHROPIC_API_KEY support — when set, pipeline uses Claude (claude-3-5-haiku) instead of OpenAI; fixes 4XX errors when only Anthropic key is available
- POST /api/pipeline/retry-failed — bulk retry all failed runs (including OPENAI_4XX); auth: session or Bearer AGENT_CRON_SECRET
- Pipeline unit tests (Phase 1): score.test.ts +5 (clamping, verdict, malformed), enrich.test.ts +3 (valid, malformed JSON, missing fields), error-classifier.test.ts +12 (classification, retryable, formatStepFailureNotes)
- S1: requireLeadAccess, requireProposalAccess helpers; applied to leads/proposals/delivery-projects routes
- S3: checkStateChangeRateLimit for capture, enrich, score, leads CRUD, proposals, delivery-projects
- S4: Health endpoint requires Bearer AGENT_CRON_SECRET or session for full response; unauthenticated gets minimal { ok }
- C1: safeParseJSON with try-catch + optional Zod; migrated learning/proposals, revenue/roi, knowledge/suggestions, copilot, ops/settings/recommend
- I3: src/lib/env-validate.ts + instrumentation.ts for startup env validation (DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL)
- A2: Pipeline step handlers extracted to src/lib/pipeline/steps.ts (runEnrichStep, runScoreStep, etc.)
- A4: Orchestrator loads lead once per run; in-memory state updates (no N+1)
- A5: Builder deploy queued as BullMQ job when Redis available; returns 202 + jobId; GET .../deploy/status?jobId= for polling
- I7: prisma migrate deploy in deploy scripts (replaces db push); migration workflow documented in VPS_DEPLOY_CHECKLIST
- I1: GitHub Actions CI workflow (.github/workflows/ci.yml) — lint, tsc, test, smoke E2E
- I2: Structured JSON logging (src/lib/ops-events/structured-log.ts); LOG_FORMAT=json; [SLOW] logs emit JSON in prod
- I4: Docker healthchecks for app (wget /api/health) and worker (kill -0 1)
- I5: Worker Dockerfile simplified — single COPY from deps, no redundant runner deps
- I6: backup.sh integrity checks: test -s and gunzip -t; exit 1 if invalid
- O1/O2: ARCHITECTURE updated (builder-deploy worker); RUNBOOK incident response (worker crash, Redis OOM, DB exhaustion, LLM outage)
- C3: truncateError utility (src/lib/truncate-error.ts)
- O3: Replaced hardcoded IP with DEPLOY_SERVER / YOUR_VPS_IP placeholder in scripts and docs
- D1: npm audit fix (0 vulnerabilities)
- D2/D3: ROADMAP dependency tracking (next-auth stable, Prisma 7)
- C5: Monitor SSL check: log errors instead of empty catch

- API routes audit: `tests/e2e/api-routes-audit.spec.ts` — hits all 394 API endpoint combinations (no auth) to ensure no 500s
- Documentation system: CLAUDE.md (AI entry point), ARCHITECTURE.md (system design), CONTRIBUTING.md (dev playbook), CHANGELOG.md, ROADMAP.md
- AI rules for code assistants: docs/ai-rules/ (coding-patterns, domain-knowledge, common-tasks, infrastructure, session-journal)
- 6 Architecture Decision Records in docs/decisions/ (Postgres queue, Claude vs OpenAI, db push, memory weights, approval gates, Docker VPS)
- Session journal system: docs/sessions/ with template for preserving thinking process across AI sessions
- Auto-generated docs from code: scripts/generate-docs.ts → docs/generated/ (api-routes, prisma-models, brain-tools, agents, pages, env-vars)
- npm scripts: docs:generate, docs:check (CI-friendly staleness check), docs:context (ChatGPT/Gemini paste file), docs:context:copy (+ clipboard)
- AI context generator: scripts/generate-ai-context.ts → single 68KB file for pasting into any AI chat
- Mandatory AI session rules at top of CLAUDE.md (auto-journal, auto-update CHANGELOG)
- ChatGPT custom instructions: docs/ai-rules/chatgpt-instructions.md (paste into ChatGPT Settings for auto session summaries)
- 6 composite database indexes for NBA/risk query performance (WeeklyMetricSnapshot, NotificationDelivery, OpsReminder, Proposal, DeliveryProject, ClientInteraction)

### Changed
- Enrichment artifacts: type standardized to "enrichment" (was "notes"); consumers accept both for backward compat
- Proposal console: "Sent on Upwork" checkbox label → "Sent"
- DeliveryChecklist, DeliveryHandoffRetention: alert() replaced with inline red error text
- Command Center: combined handoffOps + retentionOps into single deliveryProject.findMany for completed/archived (saves 1 DB round-trip)
- docs/WHEN_APP_FEELS_SLOW_CHECKLIST: added [SLOW] log inspection section and DB row; VPS grep commands for Docker
- api-utils: checkStateChangeRateLimit merges opts with defaults so windowMs/max are always numbers
- api-routes-audit: derive ok from status instead of res.ok for Playwright compatibility
- retention context: fixed closedLost++ (was missing increment)
- Command Center data fetching: 6 serial async blocks → parallel Promise.all via computeExtendedCommandCenterData()
- Dynamic imports → static imports in fetch-data.ts (classifyRetentionBucket, classifyReminderBucket, operator-score, forecasting)
- fetchRevenueInput: now date-bounded by weekStart/weekEnd (was fetching all-time data on every request)
- fetchBottlenecks: added 30s withSummaryCache to /api/metrics/bottlenecks route
- Founder summary: nextActionRun query moved from sequential into 13-way Promise.all; added select to scoreSnapshot (was fetching full JSON blobs)
- Score computation: getFactors + getPreviousSnapshot now parallel via Promise.all

### Fixed
- Sprint 5 verification: status route includes SCOPE_SENT/SCOPE_APPROVED; build route test updated for APPROVED or SCOPE_APPROVED gate and regeneration (was 409); auth mock type fixes in route tests
- Founder summary: LIKE '%pattern%' full table scan → startsWith prefix match on nextActionRun.runKey
- Score event dedup: shouldSuppressEvent overfetching full ScoreEvent row → select only createdAt
- Dockerfile: addgroup/adduser use Alpine-compatible flags (-S -g -u -G) instead of Debian long-form (--system --gid --uid)

---

## [1.0.0] - 2026-03-02

### Summary
Initial documented version. Client Engine is a full-stack AI-powered business OS with:

- 75+ Prisma models, 340 API route files (~500+ HTTP endpoints), 91 dashboard pages
- AI Brain (Claude, 25 tools, SSE streaming)
- Multi-agent system (10 workers with approval gates)
- Memory pipeline (learned weights → NBA ranking feedback)
- NBA system (15 rules, delivery actions, attribution)
- Risk engine (8 rules), Score engine (0-100)
- Notification pipeline (events → deliveries → escalations)
- Growth engine (outreach templates, deals)
- Signal engine (RSS → prospect matching)
- Meta Ads monitor, YouTube ingest, Knowledge engine
- Docker Compose deployment (5 services) on Hostinger VPS
