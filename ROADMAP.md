# Roadmap — Client Engine

## Current State (March 2026)

Phase 9+ complete. Full business OS operational with AI Brain, 11 agents (including site_builder), memory pipeline, NBA system, risk engine, scoring, notifications, growth engine, signal engine, builder integration, Site Builder 9-Phase SBP, Outcome Ledger + Scorecard (Sprint 9), and 92 dashboard pages.

## Phase 1 — Deploy Performance Indexes

- [x] Add 6 composite database indexes
- [x] Fix unbounded queries in metrics
- [x] Parallelize sequential queries (3 files)
- [x] Add select to overfetching queries
- [x] Convert dynamic imports to static
- [x] Add cache to fetchBottlenecks
- [x] Fix LIKE pattern full scan
- [x] Playwright review: all pages pass, zero console errors
- [ ] Apply indexes to production (`prisma migrate deploy` on VPS via `./scripts/deploy-remote.sh`)

## 9-Phase Enrichment

- [x] Enrich-context API in Client Engine
- [x] Site-builder enrichment module (9 phases, skills)
- [x] Phase 2 schema extensions (font, radius, shadow)
- [x] Design spec parsers + font loading + component usage
- [x] Set ENRICH_CONTEXT_SECRET in both apps for local dev
- [x] Update builder/create to use enrichment path (deliveryProjectId + enrichContextUrl)

## Phase 2 — Architecture Refactor

Implementation plan: [docs/decisions/007-phase-2-architecture-refactor-impl.md](docs/decisions/007-phase-2-architecture-refactor-impl.md)

Extract business logic from route handlers into service modules:
- [x] Lead service (list, create, getById, update, delete; list_leads, update_lead)
- [ ] Extract Brain executor CRUD for proposals, delivery, proof, signals
- [ ] Extract heavy route logic into services (promote, mark-won, complete, capture, simulate, founder-summary)
- [ ] Break brain/executor ↔ agents/runner circular dependency
- [x] Fix coach-tools HTTP self-calls → direct service calls (score, risk, nba services + coach-tools refactor)

## Phase 3 — Code Quality

Implementation plan: [docs/decisions/008-phase-3-code-quality-impl.md](docs/decisions/008-phase-3-code-quality-impl.md)

- [ ] Create shared follow-up service (deduplicate intake/proposal/delivery patterns)
- [ ] Centralize env var access (META_AD_ACCOUNT_ID, OPENAI_API_KEY)
- [ ] Extract agent prompts from registry into separate .md files
- [ ] Standardize error types (AppError, NotFoundError, ValidationError)
- [ ] Fix type safety issues (as never, as any, 55 files with JSON casts)
- [ ] Clean up magic numbers into constants
- [ ] Consolidate cron auth pattern

## Phase 4 — Route Consolidation

Implementation plan: [docs/decisions/009-phase-4-route-consolidation-impl.md](docs/decisions/009-phase-4-route-consolidation-impl.md)

- [ ] Extract delivery project route handlers into service layer (34+ routes)
- [ ] Normalize /api/internal/ vs /api/ops/ namespaces
- [ ] Merge duplicate summary endpoints

## Dependency Tracking

- **next-auth:** Currently v5 beta. Track stable release; upgrade when v5 stable. See [next-auth releases](https://github.com/nextauthjs/next-auth/releases).
- **Prisma:** Track Prisma 7; upgrade when stable. Low priority.

## Backlog

- **Held-back /work proofs** — Afterlight, Grove, Meridian, Energy Orb, Inner Green held back from the 2026-08-22 cinematic proof drop pending more craft time. Do not seed until ready.
- **/work Remotion previews** — After merge, operator runs `db:seed-portfolio-proofs` and `db:seed-work-preview-videos`, then Forge drops `public/screenshots/{slug}/preview.webm` for the eight live slugs. Do not commit huge binaries.
- **Voice assistant** — Retell/Vapi outbound when API key set; contract tests; cron schedule.
- **Client portal** — Visibility into delivery projects for clients.
- **Prisma migrations** — Prod uses `migrate deploy`; local uses `db push` per dev convention.
- OAuth flows for integrations (currently placeholder)
- Per-route Zod error messages
- Artifact provenance (promptVersion, model, pipelineRunId)
- Real content post dispatch (currently stub)

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
