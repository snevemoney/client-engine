# Session: Phase 8.0 Repo Review Implementation

**Date:** 2025-03-06
**Goal:** Execute the combined repo review + AI doctrine plan (P0 through P2.11)

## Decisions

1. **P0.1 Migration discipline:** `deploy.sh` switched from `db push --accept-data-loss` to `prisma migrate deploy`. ADR-003 superseded. All docs (README, CLAUDE.md, CONTRIBUTING, ai-rules, VPS checklist) aligned.

2. **P0.2 Degraded mode as platform rule:** Founder summary API returns `degraded: true` + reason when fallback activates. Ops event `founder.summary.degraded` logged. Shared `DegradedBanner` component created for all dashboard pages.

3. **P1.3 ranking.ts audit:** `mark_done` action weight confirmed intentional — it's the universal primary action across all NBA templates. Acts as global proxy for "operator engages with NBAs." Added explicit comment and unit test.

4. **P1.4 requireAuth:** Now emits `auth.infrastructure_error` ops event when `auth()` throws, distinguishing broken auth infra from normal unauthenticated requests.

5. **P1.5 Bounded contexts:** 9 domains mapped (Lead Intake, Proposals, Delivery/Proof, Risk/NBA, Copilot/Memory, Founder OS, Growth Engine, Agent Runtime, Jobs/Notifications) with models, routes, services, pages, and invariants.

6. **P1.6 AI Stack Doctrine:** Four-layer hierarchy (AI Engineering → Context Engineering → Intent Engineering → Prompt Engineering) with Client Engine mapping, anti-patterns, and usage guide.

7. **P1.7 Tier-A API contracts:** Standard response shapes (200, degraded, 401, 400, 429, 500), header policies, sanitization rules, test checklist. 15 new route contract tests for Growth engine (deals, prospects, summary).

8. **P1.8 Release discipline:** Single-page deploy flow reference. VPS checklist updated with ANTHROPIC_API_KEY and AGENT_CRON_SECRET.

9. **P1.9 Revenue hardening:** 5 golden scenarios documented (add prospect, draft outreach, follow-up schedule, deals filtering, growth summary) with contract assertions and revenue protection rules.

10. **P2.10 Degraded UI states:** Shared `DegradedBanner` component. Founder and Growth pages render it. Pattern established for remaining pages.

11. **P2.11 Go/No-Go:** Release readiness gate with dependency flow verification.

## What Was Built

### Code Changes
- `src/lib/api-utils.ts` — requireAuth ops event on auth failure
- `src/lib/next-actions/ranking.ts` — mark_done comment
- `src/lib/next-actions/ranking.test.ts` — mark_done proxy unit test
- `src/app/api/internal/founder/summary/route.ts` — degraded flag + ops event (previous session)
- `src/app/dashboard/founder/page.tsx` — degraded type + DegradedBanner
- `src/app/dashboard/growth/page.tsx` — degraded type + DegradedBanner
- `src/components/ui/DegradedBanner.tsx` — shared component

### New Test Files
- `src/app/api/internal/growth/deals/route.test.ts` (6 tests)
- `src/app/api/internal/growth/prospects/route.test.ts` (6 tests)
- `src/app/api/internal/growth/summary/route.test.ts` (3 tests)

### New Docs
- `docs/BOUNDED_CONTEXTS.md` — domain ownership map
- `docs/AI_STACK_DOCTRINE.md` — AI leverage hierarchy
- `docs/API_CONTRACTS.md` — response shape standards
- `docs/RELEASE_DISCIPLINE.md` — deploy flow reference
- `docs/GROWTH_GOLDEN_SCENARIOS.md` — revenue-critical scenarios
- `docs/PHASE_8_GO_NO_GO.md` — release readiness gate

## Insights

- The sanitizer (`sanitizeErrorMessage`) only strips Bearer tokens, webhook URLs, and API keys. Doesn't strip IPs, connection strings, or generic passwords. This is a gap for Phase 8.1.
- Growth E2E already covers the full golden flow. The unit-level contract tests add faster feedback.
- `mark_done` being the universal NBA action is a good design — rule-level personalization via `ruleWeights`, system-level via `actionWeights`.

## Next Steps

- Extend degraded mode to command center, scoreboard, next-actions pages
- Add 500 sanitization tests to ~15 routes still missing them
- Consider stricter sanitizer (IPs, connection strings)
- Phase 8.1: Monitoring and alerting (ops event dashboards, alert thresholds)
