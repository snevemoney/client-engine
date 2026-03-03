# Changelog

All notable changes to Client Engine are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Added
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
- Command Center data fetching: 6 serial async blocks → parallel Promise.all via computeExtendedCommandCenterData()
- Dynamic imports → static imports in fetch-data.ts (classifyRetentionBucket, classifyReminderBucket, operator-score, forecasting)
- fetchRevenueInput: now date-bounded by weekStart/weekEnd (was fetching all-time data on every request)
- fetchBottlenecks: added 30s withSummaryCache to /api/metrics/bottlenecks route
- Founder summary: nextActionRun query moved from sequential into 13-way Promise.all; added select to scoreSnapshot (was fetching full JSON blobs)
- Score computation: getFactors + getPreviousSnapshot now parallel via Promise.all

### Fixed
- Founder summary: LIKE '%pattern%' full table scan → startsWith prefix match on nextActionRun.runKey
- Score event dedup: shouldSuppressEvent overfetching full ScoreEvent row → select only createdAt

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
