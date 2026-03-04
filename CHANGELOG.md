# Changelog

All notable changes to Client Engine are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Added
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
