# Phase 4.0 — Risk + NBA Go/No-Go

**Date:** 2026-02-22  
**Branch:** main  

---

## Preflight Commands

```bash
git branch --show-current
git status --short
npx prisma generate

# Unit (risk + NBA)
npm run test -- src/lib/risk/ src/lib/next-actions/

# Full unit suite
npm run test

# Build
npm run build

# E2E (dev server required)
USE_EXISTING_SERVER=1 npm run test:e2e -- tests/e2e/risk-nba.spec.ts tests/e2e/internal-qa.spec.ts tests/e2e/api-auth.spec.ts tests/e2e/internal-api-adversarial.spec.ts
```

---

## Pass Criteria

| Check | Expected | Status |
|-------|----------|--------|
| Unit: risk rules | 9 passed | ✅ |
| Unit: NBA rules | 9 passed | ✅ |
| Unit: risk + NBA route + golden + replay | 54 passed | ✅ |
| Unit: full suite | All pass | ✅ 676 |
| Build | Success | ✅ |
| E2E: risk-nba | 8+ passed | Run with `USE_EXISTING_SERVER=1` |
| E2E: internal-qa (Risk, Next Actions) | 2 passed | Run with dev server |
| E2E: api-auth (risk, NBA 401) | 6 passed | Run with dev server |
| E2E: adversarial (risk, NBA 400) | 5 passed | Run with dev server |

---

## System Check

- `GET /api/risk/summary` — 401 without auth; 200 with auth
- `GET /api/next-actions/summary` — 401 without auth; 200 with auth
- `POST /api/risk/run-rules` — 401 without auth; 200 with auth (rate limit 10/min)
- `POST /api/next-actions/run` — 401 without auth; 200 with auth (rate limit 10/min)

---

## Manual Verification

- `/dashboard/risk` — List, filters, Run Risk Rules, snooze/resolve/dismiss
- `/dashboard/next-actions` — List, filters, Run Next Actions, done/dismiss
- `/dashboard/command` — RiskNBACard visible with top risks/actions
- `/dashboard/internal/qa/risk` — System readiness, checklist
- `/dashboard/internal/qa/next-actions` — System readiness, checklist

---

## GO/NO-GO Decision

### **GO** / **NO-GO**

*Unit + build passed 2026-02-22. E2E requires dev server.*

**What passed:**
- Unit: 676 tests (risk rules 9, NBA rules 9, route contracts, golden regression, replay integration)
- Build: Success
- Phase 4.0.1: Validation matrix, Retry-After on 429, sanitized 500, golden fixtures, workflow replay

**Blockers:**
- None for unit/build. E2E: run `USE_EXISTING_SERVER=1 npm run test:e2e` with `npm run dev` in another terminal.

---

## Rollback Snapshot

| Item | Value |
|------|-------|
| Tag | phase-4.0-go |
| DB backup | — |
