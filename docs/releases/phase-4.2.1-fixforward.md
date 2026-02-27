# Phase 4.2.1 — Delivery Paths Prod-Readiness + E2E Safety (Fix-Forward)

**Date:** February 2026  
**Scope:** Phase 4.2 hardening — migrations, env, E2E guards, route tests, cleanup.

---

## Step 0 — Inventory

### Phase 4.2 Related Changes

| Category | Item | Deploy-Critical? |
|----------|------|------------------|
| **Prisma migration** | `20260226_next_action_execution_delivery` — NextActionExecution table + NextBestAction fields | Yes |
| **Env vars** | None new in Phase 4.2 (uses existing auth) | No |
| **API routes** | `POST /api/next-actions/[id]/execute` | Yes |
| **Playwright specs** | risk-nba, run-pipeline-leads, score-intake-leads (mutating) | Dev-only (guards) |

### Deploy-Critical Checklist

- [ ] Run `npx prisma migrate deploy` in staging/prod
- [ ] Verify NextActionExecution table exists after deploy
- [ ] No new env vars required

### Dev-Only Checklist

- [ ] E2E mutation guard covers all mutating specs
- [ ] Route contract tests for execute endpoint (401, 400, 404, 429 + Retry-After)
- [ ] Remove empty artifacts (snapshot-output.md — already removed)
- [ ] Lockfile consistency

---

## Step 1 — Prisma Migration Deploy Safety

**Migration folder:** `prisma/migrations/20260226_next_action_execution_delivery/`

**Required command:**
```bash
npx prisma migrate deploy
```

**Expected changes:**
- `NextBestAction`: new columns `snoozedUntil`, `lastExecutedAt`, `lastExecutionStatus`, `lastExecutionErrorCode`, `lastExecutionErrorMessage`
- `NextActionExecution`: new table with `id`, `nextActionId`, `actionKey`, `status`, `startedAt`, `finishedAt`, `errorCode`, `errorMessage`, `metaJson`

**Rollback:** Backup DB before deploy. To roll back: drop `NextActionExecution` table and remove new columns from `NextBestAction` (manual SQL). No automated rollback migration.

---

## Changes in This Fix-Forward

1. **Step 2:** `docs/ENV_CHANGES_PHASE_4_2.md` — Phase 4.2 adds no new env vars
2. **Step 3:** `tests/e2e/helpers/safety.ts` — `requireSafeE2EBaseUrl()`; apply to all mutating specs; `tests/e2e/safety-guard.spec.ts` sanity tests
3. **Step 4:** Execute route test — add 429 + Retry-After assertion
4. **Step 5:** snapshot-output.md already removed; add to .gitignore
5. **Step 6:** npm install + build + test

---

## Step 7 — Validation Commands

```bash
# Unit tests (execute route + 429)
npm run test -- --run "src/app/api/next-actions/[id]/execute/route.test.ts"

# E2E safety guard sanity
USE_EXISTING_SERVER=1 npx playwright test tests/e2e/safety-guard.spec.ts

# Full build
npm run build

# Full unit tests
npm run test -- --run
```

---

## Recommended Commit Breakdown

1. **docs(env+migrations): Phase 4.2 deployment notes**
   - `docs/releases/phase-4.2.1-fixforward.md`
   - `docs/ENV_CHANGES_PHASE_4_2.md`

2. **test(e2e): apply mutation safety guard broadly**
   - `tests/e2e/helpers/safety.ts`
   - `tests/e2e/safety-guard.spec.ts`
   - All mutating specs (risk-nba, run-pipeline-leads, score-intake-leads, smoke, flywheel, client-acquisition, sales-layer, scoreboard, learning-ingest, prod-readiness-workflows, full-flow, internal-qa, score-alerts, internal-api-adversarial, prod, lead-copilot)

3. **test(api): route contract tests + Retry-After header**
   - `src/app/api/next-actions/[id]/execute/route.test.ts`

4. **chore: remove empty artifact + lockfile consistency**
   - `.gitignore` (snapshot-output.md)
