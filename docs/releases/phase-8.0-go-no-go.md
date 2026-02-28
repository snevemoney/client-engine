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
| All unit tests | 853 | 5 | ❌ FAIL |

**Failing tests:**
1. `src/lib/growth/nba-integration.test.ts` — growth_schedule_followup_3d (Unique constraint on dedupeKey)
2. `src/lib/growth/nba-integration.test.ts` — growth_mark_replied (Unique constraint on dedupeKey)
3. `src/app/api/next-actions/route.test.ts` — Phase 4.2: hides snoozed items
4. `src/app/api/internal/copilot/coach/action/route.test.ts` — execute returns before + after (500 instead of 200)

### E2E Tier-A Smoke

| Spec | Pass | Fail | Flaky | Skip | Result |
|------|------|------|-------|------|--------|
| smoke.spec.ts | 2 | 0 | 0 | 0 | ✅ |
| scoreboard.spec.ts | 19 | 0 | 0 | 0 | ✅ |
| risk-nba.spec.ts | 12 | 0 | 1 | 0 | ⚠️ |
| coach-mode.spec.ts | 3 | 0 | 0 | 0 | ✅ |
| founder-mode.spec.ts | 2 | 2 | 0 | 0 | ❌ |
| memory.spec.ts | 5 | 1 | 0 | 0 | ❌ |
| internal-qa.spec.ts | 6 | 0 | 0 | 1 | ✅ |
| **Total** | **49** | **3** | **1** | **1** | ❌ |

**Failing E2E:**
- `founder-mode.spec.ts`: Click Run Next Actions works, Save week plan persists
- `memory.spec.ts`: Run NBA then dismiss (strict mode / text mismatch)

**Flaky:**
- `risk-nba.spec.ts`: Next Actions page list renders (strict mode: multiple elements)

---

## GO Gate Criteria

| Criterion | Required | Actual |
|----------|----------|--------|
| Build | ✅ | ✅ |
| Unit (all) | ✅ | ❌ (5 fail) |
| Route contract (Tier-A) | ✅ | ⚠️ (4 route tests fail) |
| Tier-A E2E smoke | ✅ | ❌ (3 fail, 1 flaky) |
| Docs (matrix + contracts + go/no-go) | ✅ | ✅ |

---

## GO/NO-GO Decision

### **NO-GO**

**Reason:** Unit tests (5) and E2E (3 fail, 1 flaky) do not meet the GO gate.

**Blockers:**
1. **Unit:** Growth NBA integration tests — dedupeKey collision in test setup
2. **Unit:** Next-actions route — snoozed items filter assertion
3. **Unit:** Copilot coach action — execute returns 500 (mock/setup issue)
4. **E2E:** Founder mode — Run Next Actions, Save week plan (timing or text mismatch)
5. **E2E:** Memory — Run NBA then dismiss (strict mode: "Failed" matches link text)
6. **E2E:** Risk-NBA — Next Actions list (strict mode: multiple elements)

---

## Docs Delivered

| Doc | Status |
|-----|--------|
| `docs/PHASE_8_0_APP_AUDIT_MATRIX.md` | ✅ |
| `docs/PHASE_8_0_TIER_A_CONTRACTS.md` | ✅ |
| `docs/releases/phase-8.0-go-no-go.md` | ✅ |

---

## Recommended Fixes (Pre-GO)

1. **Growth NBA integration:** Use unique dedupeKey per test (e.g. `dedupeKey: \`test_${Date.now()}_${Math.random()}\``)
2. **Next-actions route test:** Fix snoozed filter assertion or test data
3. **Copilot coach action:** Fix mock/setup so execute returns 200
4. **Founder E2E:** Broaden text matcher (e.g. include "failed" / "completed" variants)
5. **Memory E2E:** Use `.first()` or more specific locator for "Next actions run completed" / "Failed"
6. **Risk-NBA E2E:** Use `.first()` for list content locator to avoid strict mode

---

## Rollback

No release tag created. Branch remains at current state.
