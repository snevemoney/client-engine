# Phase 3.6: Go/No-Go Production Readiness Checklist

Pre-production verification before deploying to production.

---

## 1. Auth Protections Verified

- [ ] All internal API routes return 401 when called without valid session
- [ ] `/api/internal/ops/metrics-summary` protected
- [ ] `/api/internal/system/check` protected
- [ ] Score routes (compute, history, latest, summary, alerts/preferences) protected
- [ ] Bearer RESEARCH_CRON_SECRET works for workday-run, research/run (set in .env from .env.example; Playwright fallback for CI)

**How to verify:** Run `npx playwright test tests/e2e/api-auth.spec.ts`

---

## 2. DB Schema Applied

- [ ] Migrations applied: `npx prisma migrate deploy`
- [ ] No pending migrations: `npx prisma migrate status`

---

## 3. Seeds / Default Settings Present

- [ ] `score_alerts_preferences` internal setting exists (or defaults applied)
- [ ] Notification channels seeded (in_app, etc.)
- [ ] Escalation rules seeded
- [ ] Job schedules for notifications

**How to verify:** Run `npx prisma db seed` if needed; check Internal QA pages show expected state.

---

## 4. Internal System Check Healthy

- [ ] `GET /api/internal/system/check` returns 200 (with auth)
- [ ] `health.hasInAppChannel` reflects config
- [ ] `health.hasBaselineEscalationRule` reflects config
- [ ] `health.queueConfigured` reflects config
- [ ] `health.internalRoutesProtected` is true
- [ ] `scoreAlerts.configured` and `scoreAlerts.enabled` present when applicable
- [ ] **No sensitive env values** (DATABASE_URL, secrets, keys) in response

**How to verify:** Login → Notifications QA page → System check section; or `curl` with session cookie.

---

## 5. Metrics Endpoint Returns Expected Values

- [ ] `GET /api/internal/ops/metrics-summary?period=24h` returns 200
- [ ] `GET /api/internal/ops/metrics-summary?period=7d` returns 200
- [ ] Response has `period`, `notifications`, `deliveries`, `escalations`, `jobs`
- [ ] `jobs.staleRunning` is numeric (not null)
- [ ] No-data case returns zero values (no null explosions)
- [ ] **No secrets** in response

---

## 6. Notifications / Scoring Flows Verified

- [ ] Score compute creates snapshot and events
- [ ] Score events trigger notifications when enabled + not in cooldown
- [ ] Cooldown suppresses duplicate notifications
- [ ] Alerts preferences toggle and cooldown persist
- [ ] In-app inbox shows notifications
- [ ] **Event persistence contract:** Score events always stored even when notifications suppressed (Phase 3.6.3)

**How to verify:** Run E2E `scoreboard.spec.ts`, `score-alerts.spec.ts`, `prod-readiness-workflows.spec.ts`; unit `compute-and-store.test.ts`, `replay-integration.test.ts`

---

## 7. No Unsanitized Secrets in Responses/Logs

- [ ] Error responses do not contain stack traces
- [ ] Error responses do not contain tokens, keys, webhook URLs
- [ ] `configJson` in any payload is redacted or masked
- [ ] Ops events use `sanitizeErrorMessage`, `sanitizeMeta`
- [ ] `sanitizeErrorMessage` redacts Bearer tokens, webhook URLs, API keys in error messages (Phase 3.6.2)

**How to verify:** Run `internal-api-adversarial.spec.ts`; `ops-events/sanitize.test.ts`; grep codebase for raw `err` in responses.

---

## 7.5 Failure Behavior Verified (Phase 3.6.4)

- [ ] Compute route: DB/compute failure → 500 with sanitized message (no secrets, no stack traces)
- [ ] Summary, history, latest, metrics-summary: DB failure → 500 sanitized (try/catch + `sanitizeErrorMessage`)
- [ ] Score event + snapshot persist when notification delivery fails (adapter throw)
- [ ] Scoreboard: summary API 500 → `score-error` visible, Recompute button not stuck
- [ ] Alerts preferences: PUT 500 → `alerts-prefs-error` visible, Save re-enabled, no false "saved" state
- [ ] Channel config parse failure: graceful handling, other valid channels proceed

**Guaranteed:**
- API error responses are sanitized (Bearer, webhooks, keys redacted)
- Score events and snapshots persist when notification delivery fails or is suppressed
- UI degrades safely with explicit error states

**Known limits:**
- No true concurrency/integration tests with external providers
- E2E failure injection via route interception (not DB-level)

**How to verify:** `route-resilience.test.ts`, `compute-and-store.test.ts` (resilience test), `scoreboard.spec.ts`, `score-alerts.spec.ts`

---

## 7.6 Golden Regression Suite (Phase 3.6.5)

- [ ] **Required before deploy:** `golden-regression.test.ts` and `golden-replay.route.test.ts` pass
- [ ] **Optional (code-only change):** E2E golden smoke (`scoreboard.spec.ts` "3.6.5") — run when UI/scoreboard touched

**Commands:**
```bash
npm run test -- src/lib/scoring/golden-regression.test.ts src/app/api/internal/scores/golden-replay.route.test.ts
npm run test:e2e tests/e2e/scoreboard.spec.ts --grep "3.6.5"
```

**See:** `docs/PHASE_3_6_5_GOLDEN_SCENARIOS.md`

---

## 8. E2E Smoke Checks Passed

- [ ] `npx playwright test tests/e2e/smoke.spec.ts`
- [ ] `npx playwright test tests/e2e/api-auth.spec.ts`
- [ ] `npx playwright test tests/e2e/internal-api-adversarial.spec.ts`
- [ ] `npx playwright test tests/e2e/prod-readiness-workflows.spec.ts`

---

## 9. Known Issues (if any)

Record any known limitations or acceptable risks before Go:

| Issue | Severity | Mitigation | Blocker |
|-------|----------|------------|---------|
| ~~Internal API routes return 404~~ | ~~High~~ | **RESOLVED** — routes return 401 | No |
| E2E requires running dev server | Medium | Use Playwright webServer in CI | No |
| No golden scenarios for review_stream | Low | Add if critical | No |
| No true concurrency / external provider E2E | Low | Accept for initial release | No |

---

## Go Decision

- **GO:** All items above checked; known issues documented and accepted.
- **NO-GO:** Any critical item unchecked; re-validate after fixes.

### Phase 3.6.6 Execution (2026-02-22)

- **Unit/integration:** 145 passed (release-gating)
- **Golden regression:** 9 passed
- **Build:** PASS (post type fixes in run-golden-scenario)
- **E2E:** 86 passed, 2 skipped (Bearer auth)
- **Decision:** **GO**

**Evidence:** `docs/releases/phase-3.6.6-go-no-go.md`
