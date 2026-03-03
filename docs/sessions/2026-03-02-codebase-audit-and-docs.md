# Session: Full Codebase Audit + Documentation System — 2026-03-02

## Goal
Review the entire codebase, identify refactoring opportunities, apply performance fixes, Playwright-test all pages, and create a complete documentation system.

## Decisions Made
- **Documentation structure:** CLAUDE.md (AI entry) + ARCHITECTURE.md + CONTRIBUTING.md + ADRs + auto-generated docs + AI rules files + session journals
- **Performance first:** Applied Phase 1 quick wins before architecture refactoring (higher impact, lower risk)
- **Keep existing docs:** 82 existing docs in `docs/` kept as-is; new system links to them rather than replacing
- **Auto-update approach:** Script scans source code (routes, schema, tools, agents, pages, env) → generates markdown files in `docs/generated/`
- **Session journal system:** After each AI work session, summarize decisions + changes → `docs/sessions/`

## What Was Built

### Performance Fixes (Phase 1)
- **`prisma/schema.prisma`** — Added 6 composite indexes (WeeklyMetricSnapshot, NotificationDelivery, OpsReminder, Proposal, DeliveryProject, ClientInteraction)
- **`src/lib/metrics/fetch-metrics.ts`** — Date-bounded fetchRevenueInput (was fetching all-time data regardless of range)
- **`src/lib/scoring/compute-and-store.ts`** — Parallelized getFactors + getPreviousSnapshot; added select to shouldSuppressEvent
- **`src/app/api/internal/founder/summary/route.ts`** — Moved nextActionRun query into Promise.all; added select to scoreSnapshot; changed LIKE '%pattern%' to startsWith
- **`src/lib/command-center/fetch-data.ts`** — Extracted 6 serial async blocks into parallel computeExtendedCommandCenterData(); converted 3 dynamic imports to static
- **`src/app/api/metrics/bottlenecks/route.ts`** — Added withSummaryCache (30s TTL)

### Documentation System (19 new files)
- **Root docs (5):** CLAUDE.md, ARCHITECTURE.md, CONTRIBUTING.md, CHANGELOG.md, ROADMAP.md
- **AI rules (5):** coding-patterns.md, domain-knowledge.md, common-tasks.md, infrastructure.md, session-journal.md
- **ADRs (6):** Postgres queue, Claude vs OpenAI, db push, memory weights, approval gates, Docker VPS
- **Auto-gen script:** scripts/generate-docs.ts → 6 files in docs/generated/ (api-routes, prisma-models, brain-tools, agents, pages, env-vars)
- **Session journal (1):** This file (docs/sessions/2026-03-02-codebase-audit-and-docs.md)
- **npm scripts:** docs:generate, docs:check
- **Directories created:** docs/decisions/, docs/generated/, docs/sessions/, docs/ai-rules/

### Playwright Review
Tested all key pages in dev — zero console errors:
- Public site, login, founder/home, leads (82 leads), proposals, delivery, delivery detail, risk, next-actions, follow-ups, intake, command center (30+ cards)

## Key Insights
- Command Center is the heaviest page (58 slow query warnings) — the 6 serial async blocks in fetchCommandCenterData were a major bottleneck, now parallelized
- fetchRevenueInput was fetching EVERY accepted proposal and EVERY completed delivery project regardless of date range — a full table scan on every metrics request
- The founder summary route had a sequential nextActionRun query AFTER a 12-way Promise.all — adding it to the Promise.all saves one full round-trip
- The LIKE '%pattern%' on nextActionRun.runKey couldn't use the btree index — switching to startsWith enables prefix matching

## Trade-offs Accepted
- Phase 2-5 refactoring (service extraction, code quality, route consolidation) deferred to future sessions
- AI rules files are opinionated — they encode current patterns, may need updating as architecture evolves
- Generated docs include date stamps — will show as "stale" if not regenerated regularly (by design, to encourage running the script)

## Open Questions
- Should the builder service directory be scaffolded? (Currently only proxy routes exist)
- Should CLAUDE.md be copied to `.cursor/rules` for Cursor compatibility?
- Should session journals be git-committed or gitignored?

## Next Steps
- [ ] Apply composite indexes to production (`prisma db push` on VPS)
- [ ] Phase 2: Extract Brain executor CRUD into domain services
- [ ] Phase 3: Create shared follow-up service
- [ ] Consider adding pre-push hook for `docs:check`
