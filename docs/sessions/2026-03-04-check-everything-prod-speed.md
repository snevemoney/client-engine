# Session: Check Everything and Prod Speed

**Date:** 2026-03-04

## Goal

Implement the Check Everything and Prod Speed plan: verify app health, run API audit against prod, document prod speed diagnostics, and apply Command Center optimizations.

## Decisions

- Fixed TypeScript errors (api-utils rate limit opts, api-routes-audit res.ok) and retention context closedLost++ bug
- Combined handoffOps + retentionOps into a single deliveryProject.findMany in fetch-data.ts (saves 1 DB round-trip)
- Added [SLOW] log inspection section to WHEN_APP_FEELS_SLOW_CHECKLIST.md
- Did not add take limits to proposal/delivery findMany — counts require full iteration; indexes already exist for opsEvent and auditAction

## What Was Built

1. **Verification**
   - Type check passes
   - Unit tests pass (898 tests)
   - Docs check passes
   - API audit against prod: 395 requests, no 500s
   - Smoke E2E: requires USE_EXISTING_SERVER=1 when dev server already running

2. **Prod speed**
   - Health check: https://evenslouis.ca/api/health ~1.9s (under 2s)
   - Updated docs/WHEN_APP_FEELS_SLOW_CHECKLIST.md with [SLOW] grep commands for Docker

3. **Command Center**
   - Merged handoffOps and retentionOps into one findMany for completed/archived projects
   - Single query with combined select, derive both handoffOps and retentionOps from result

4. **Fixes**
   - api-utils: checkStateChangeRateLimit uses { ...STATE_CHANGE_RATE_LIMIT, ...opts } so windowMs/max are always numbers
   - api-routes-audit: ok derived from status >= 200 && status < 300 (Playwright res.ok type issue)
   - retention context: closedLost++ was missing increment

## Insights

- OpsEvent and AuditAction already have suitable indexes ([level, createdAt], [actionKey, createdAt])
- API audit against prod is fast (~1.8 min) and confirms no 500s
- Further Command Center gains (shared fetchBottlenecks/fetchOperatorScoreInput, lazy extended metrics) would require larger refactors

## Next Steps

- Run smoke E2E with USE_EXISTING_SERVER=1 when dev server is up
- On VPS: `docker compose logs app 2>&1 | grep '\[SLOW\]'` to identify slow routes
- Consider splitting extended metrics into separate endpoint if Command Center remains slow
