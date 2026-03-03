# Roadmap — Client Engine

## Current State (March 2026)

Phase 9+ complete. Full business OS operational with AI Brain, 10 agents, memory pipeline, NBA system, risk engine, scoring, notifications, growth engine, signal engine, builder integration, and 91 dashboard pages.

## Active Work

### Performance Refactor (Phase 1 — Done, pending production deploy)
- [x] Add 6 composite database indexes
- [x] Fix unbounded queries in metrics
- [x] Parallelize sequential queries (3 files)
- [x] Add select to overfetching queries
- [x] Convert dynamic imports to static
- [x] Add cache to fetchBottlenecks
- [x] Fix LIKE pattern full scan
- [x] Playwright review: all pages pass, zero console errors
- [ ] Apply indexes to production (`prisma db push` on VPS)

### Documentation System — Done
- [x] CLAUDE.md, ARCHITECTURE.md, CONTRIBUTING.md, CHANGELOG.md, ROADMAP.md
- [x] Architecture Decision Records (6 initial ADRs)
- [x] AI rules: coding-patterns, domain-knowledge, common-tasks, infrastructure
- [x] Session journal system (docs/sessions/ + docs/ai-rules/session-journal.md)
- [x] Auto-generated docs script (scripts/generate-docs.ts)
- [x] npm scripts (docs:generate, docs:check)

## Next Up

### Architecture Refactor (Phase 2)
Extract business logic from route handlers into service modules:
- [ ] Extract Brain executor CRUD into domain services (leads, proposals, delivery, proof, signals)
- [ ] Extract heavy route logic into services (promote, mark-won, complete, capture, simulate, founder-summary)
- [ ] Break brain/executor ↔ agents/runner circular dependency
- [ ] Fix coach-tools HTTP self-calls → direct service calls

### Code Quality (Phase 3)
- [ ] Create shared follow-up service (deduplicate intake/proposal/delivery patterns)
- [ ] Centralize env var access (META_AD_ACCOUNT_ID, OPENAI_API_KEY)
- [ ] Extract agent prompts from registry into separate .md files
- [ ] Standardize error types (AppError, NotFoundError, ValidationError)
- [ ] Fix type safety issues (as never, as any, 55 files with JSON casts)
- [ ] Clean up magic numbers into constants
- [ ] Consolidate cron auth pattern

### Route Consolidation (Phase 4)
- [ ] Extract delivery project route handlers into service layer (34+ routes)
- [ ] Normalize /api/internal/ vs /api/ops/ namespaces
- [ ] Merge duplicate summary endpoints

## Future Ideas (Backlog)

- Builder service scaffolding (directory doesn't exist yet)
- OAuth flows for integrations (currently placeholder)
- Per-route Zod error messages
- Artifact provenance (promptVersion, model, pipelineRunId)
- Prisma migration history (currently using db push)
- Real content post dispatch (currently stub)
- Client portal for delivery project visibility

## Completed Phases

| Phase | What | Docs |
|-------|------|------|
| 0 | Baseline + context | PROJECT_CONTEXT.md |
| 1 | Pipeline metrics | docs/PHASE1.2_INTAKE_PIPELINE.md |
| 2 | Positioning engine + follow-ups + revenue | docs/PHASE_2_*.md |
| 3 | Safety hardening (build gate, error classifier) | PROJECT_CONTEXT.md |
| 4 | Risk + NBA system | docs/PHASE_4_0_RISK_NBA.md |
| 5 | Coach mode + copilot | docs/PHASE_5_1_COACH_MODE.md |
| 6 | Founder OS + scoring + forecasting | docs/PHASE_6_1_FOUNDER_MODE.md |
| 7 | Memory pipeline V1 | docs/PHASE_7_1_MEMORY_V1.md |
| 8 | App audit + production hardening | docs/PHASE_8_0_APP_AUDIT_MATRIX.md |
| 9 | Multi-agent system + builder integration | — |
