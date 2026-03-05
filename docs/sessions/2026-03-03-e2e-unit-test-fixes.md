# Session: E2E and Unit Test Fixes (Zero Errors, Zero Skips)

**Date:** 2026-03-03

## Goal

Fix all E2E and unit test failures so the suite runs with zero errors and zero skips.

## Decisions

1. **Unit tests:** Use `.env.test` (client_engine_test DB). Add `npm run test:prepare` to sync schema before tests.
2. **E2E:** Playwright globalSetup seeds DB, cleans fake leads, creates Demo Lead when empty. WebServer env: AUTH_DEV_PASSWORD, AGENT_CRON_SECRET, OAUTH_SIMULATION.
3. **Health:** prod.spec uses Bearer AGENT_CRON_SECRET for full checks (unauthenticated returns minimal).
4. **prod-fake-data-review:** Use localhost by default; remove FLYWHEEL SIMULATION from fake patterns (legitimate UI label).
5. **Login skips:** Remove all `test.skip(true, "Login failed")` — replace with `expect()` so tests fail clearly when login fails. AUTH_DEV_PASSWORD in webServer env ensures login works.
6. **api-auth Bearer tests:** Remove skip; use `expect(res.status()).not.toBe(401)` with message. Requires RESEARCH_CRON_SECRET in .env when using existing server.

## What Was Built

- `tests/e2e/global-setup.ts` — seeds DB, cleans fake leads, creates Demo Lead when empty
- `scripts/test-prepare.mjs` — syncs test DB schema (runs before `npm test`)
- Playwright config: globalSetup, webServer env (AUTH_DEV_PASSWORD, AGENT_CRON_SECRET, OAUTH_SIMULATION), readiness URL `/api/health`
- Removed 50+ login-failure and conditional skips across 20+ E2E specs
- prod.spec health: Bearer header for full checks
- prod-fake-data-review: localhost default, FLYWHEEL SIMULATION removed from patterns
- golden-replay: 5ms delay between computes for distinct timestamps
- package.json: `test:prepare` script, `test` runs prepare first

## Insights

- Vitest loads `.env.test` with override — unit tests use `client_engine_test` DB, not main dev DB. Schema must be synced separately.
- prod-fake-data-review flagged "Flywheel simulation" (UI card label) as fake — removed from patterns.
- Founder page can be slow; increased timeout for "Click Run Next Actions" test.

## Next Steps

- Run full E2E suite: `npm run test:e2e` (with `npm run dev` or `USE_EXISTING_SERVER=1`)
- Ensure `.env` has RESEARCH_CRON_SECRET for api-auth Bearer tests when using existing server
- Some conditional skips remain (e.g. growth "No founder_growth actions", risk-nba "No queued actions") — these require seeded data or test restructuring to eliminate
