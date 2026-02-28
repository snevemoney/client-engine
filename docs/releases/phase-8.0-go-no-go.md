# Phase 8.0 — GO/NO-GO Release Decision

**Date:** 2026-02-26  
**Branch:** main  
**Scope:** Full App Audit + Reliability Hardening (Tier-A)

---

## Required Commands

```bash
npm run build
npm run test
USE_EXISTING_SERVER=1 npm run test:e2e -- \
  tests/e2e/smoke.spec.ts \
  tests/e2e/scoreboard.spec.ts \
  tests/e2e/risk-nba.spec.ts \
  tests/e2e/coach-mode.spec.ts \
  tests/e2e/founder-mode.spec.ts \
  tests/e2e/memory.spec.ts \
  tests/e2e/internal-qa.spec.ts
```

---

## Pass Counts

### Build

| Command | Result |
|---------|--------|
| `npm run build` | ✅ PASS |

### Unit / Route Contract

| Suite | Pass | Fail | Result |
|-------|------|------|--------|
| All unit tests | 857 | 1 | ⚠️ Partial |

**Fixed (commit c7f90e6):**
1. `src/lib/growth/nba-integration.test.ts` — unique dedupeKey per test run
2. `src/app/api/next-actions/route.test.ts` — snoozed filter: isolated scope + real time
3. `src/app/api/internal/copilot/coach/action/route.test.ts` — mock attribution, addActionLog returns `{ id }`

**Remaining failure:**
1. `src/lib/growth/golden-regression.test.ts` — golden_growth_overdue_followup (created.created === 0)

### E2E Tier-A Smoke

| Spec | Pass | Fail | Flaky | Skip | Result |
|------|------|------|-------|------|--------|
| smoke.spec.ts | 2 | 0 | 0 | 0 | ✅ |
| scoreboard.spec.ts | 19 | 0 | 0 | 0 | ✅ |
| risk-nba.spec.ts | 13 | 0 | 0 | 0 | ✅ |
| coach-mode.spec.ts | 3 | 0 | 0 | 0 | ✅ |
| founder-mode.spec.ts | 5 | 0 | 0 | 0 | ✅ |
| memory.spec.ts | 6 | 0 | 0 | 0 | ✅ |
| internal-qa.spec.ts | 6 | 0 | 0 | 1 | ✅ |
| **Total** | **54** | **0** | **0** | **1** | ✅ |

**Fixed (commit c7f90e6):**
- `founder-mode.spec.ts`: scoped locator to founder-page, fixed getByDisplayValue → toHaveValue
- `memory.spec.ts`: scoped locator to founder-page for result text
- `risk-nba.spec.ts`: added `.first()` to avoid strict mode on multi-element locator

---

## GO Gate Criteria

| Criterion | Required | Actual |
|----------|----------|--------|
| Build | ✅ | ✅ |
| Unit (all) | ✅ | ⚠️ (1 fail: golden-regression) |
| Route contract (Tier-A) | ✅ | ✅ |
| Tier-A E2E smoke | ✅ | ✅ |
| Docs (matrix + contracts + go/no-go) | ✅ | ✅ |

---

## GO/NO-GO Decision

### **CONDITIONAL GO**

**Reason:** E2E Tier-A smoke passes (54). Route contract tests pass. One unit test remains: `golden-regression.test.ts` (growth overdue followup).

**Resolved (commit c7f90e6):**
1. **Unit:** Growth NBA integration — unique dedupeKey
2. **Unit:** Next-actions route — snoozed filter with isolated scope
3. **Unit:** Copilot coach action — attribution + addActionLog mocks
4. **E2E:** Founder, memory, risk-nba — locator fixes

**Remaining blocker:**
1. **Unit:** `golden-regression.test.ts` — golden_growth_overdue_followup (upsert returns created: 0)

---

## Docs Delivered

| Doc | Status |
|-----|--------|
| `docs/PHASE_8_0_APP_AUDIT_MATRIX.md` | ✅ |
| `docs/PHASE_8_0_TIER_A_CONTRACTS.md` | ✅ |
| `docs/releases/phase-8.0-go-no-go.md` | ✅ |

---

## Recommended Fixes (Pre-Full GO)

1. **Golden regression:** Fix `golden_growth_overdue_followup` — upsertNextActions returns created: 0 (idempotency or cleanup needed)

---

## Rollback

No release tag created. Branch remains at current state.
