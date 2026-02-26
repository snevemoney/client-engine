# Phase 4.0: Risk + NBA Validation Matrix

**Coverage for Risk Flags and Next-Best-Action.** Extends Phase 3.6 validation matrix. Phase 4.0.1 production readiness validation.

---

## Summary

| Area | Tests | Status |
|------|-------|--------|
| Risk rules (unit) | risk/rules.test.ts (9) | ✅ |
| NBA rules (unit) | next-actions/rules.test.ts (9) | ✅ |
| Risk golden regression | risk/golden-regression.test.ts (4) | ✅ |
| NBA golden regression | next-actions/golden-regression.test.ts (4) | ✅ |
| Risk route contract | risk/*.route.test.ts | ✅ |
| NBA route contract | next-actions/*.route.test.ts | ✅ |
| Risk replay integration | risk/replay-integration.test.ts | ✅ |
| NBA replay integration | next-actions/replay-integration.test.ts | ✅ |
| API auth (401) | api-auth.spec.ts | ✅ |
| Adversarial (400) | internal-api-adversarial.spec.ts | ✅ |
| E2E risk page | risk-nba.spec.ts | ✅ |
| E2E NBA page | risk-nba.spec.ts | ✅ |
| E2E Command Center | risk-nba.spec.ts (RiskNBACard) | ✅ |
| Internal QA pages | internal-qa.spec.ts | ✅ |

---

## Workflow Replay Matrix (Phase 3.6 style)

| Scenario | Trigger | DB Result | Notification | API Response | Coverage |
|----------|---------|-----------|--------------|--------------|----------|
| **Run rules → summary/list** | POST run-rules | RiskFlag(s) | Critical → NotificationEvent | 200, created/updated/criticalNotified | replay-integration.test |
| **Rerun idempotency** | 2× POST run-rules | No duplicate flags | No double notification | Second run: created=0 | replay-integration.test |
| **Run NBA → summary** | POST run | NextBestAction(s) | — | 200, created/updated | replay-integration.test |
| **Dismiss persists** | POST run → PATCH dismiss → POST run | Dismissed stays dismissed | — | Summary reflects dismiss | replay-integration.test |

---

## Failure Injection (Resilience)

| Scenario | Trigger | Injected Failure | API Result | Coverage |
|----------|---------|------------------|------------|----------|
| Rate limit 429 | POST run-rules / POST run | rateLimitByKey !ok | 429, Retry-After header, retryAfterSeconds | run-rules/route.test, run/route.test |
| DB/service throws | upsertRiskFlags throws | Adapter/DB error | 500, sanitized error | run-rules/route.test "DB failure Bearer sanitized" |
| Bearer in error | Error contains Bearer sk_ | — | Response has [redacted], no sk_ | run-rules/route.test |

---

## Golden Regression Suite

| Scenario | Input Fixture | Expected DB Writes | Coverage |
|----------|---------------|---------------------|----------|
| golden_risk_no_critical_no_notification | Healthy band | No NotificationEvent | golden-regression.test |
| golden_risk_critical_creates_notification | Critical band | RiskFlag, NotificationEvent | golden-regression.test |
| golden_risk_rerun_is_idempotent | 2× run-rules | Second run: created=0 | golden-regression.test |
| golden_risk_dismiss_then_rerun_does_not_reopen | Dismiss → run-rules | No reopen | golden-regression.test |
| golden_nba_empty_context | No critical band | No actions | golden-regression.test |
| golden_nba_rerun_idempotent | 2× upsert | Second: created=0 | golden-regression.test |
| golden_nba_done_removes_from_open_counts | Complete action | status=done, not in queued | golden-regression.test |

---

## Route Inventory

| Route | Auth | Happy Path | Validation | Failure / Sanitization |
|-------|------|------------|------------|------------------------|
| GET /api/risk | ✅ 401 | route.test (list, pagination, filters, search) | — | — |
| GET /api/risk/summary | ✅ 401 | summary/route.test (shape, Cache-Control) | — | 500 generic message |
| POST /api/risk/run-rules | ✅ 401 | run-rules/route.test | — | 429 Retry-After, 500 sanitized |
| PATCH /api/risk/[id] | ✅ 401 | [id]/route.test (dismiss/resolve/snooze) | Invalid action 400 | 500 sanitized |
| GET /api/next-actions | ✅ 401 | route.test (list, pagination, filters) | — | — |
| GET /api/next-actions/summary | ✅ 401 | summary/route.test (shape, Cache-Control) | — | — |
| POST /api/next-actions/run | ✅ 401 | run/route.test | — | 429 Retry-After, 500 sanitized |
| PATCH /api/next-actions/[id] | ✅ 401 | [id]/route.test (done/dismiss) | Invalid action 400 | 500 sanitized |

---

## Unit Tests

| # | Scenario | File | Test |
|---|----------|------|------|
| 1 | Empty context → no risks | risk/rules.test.ts | returns empty array for zero context |
| 2 | failedDeliveryCount24h ≥ 3 → critical risk | risk/rules.test.ts | emits critical_notifications_failed_delivery |
| 3 | staleRunningJobsCount ≥ 1 → high risk | risk/rules.test.ts | emits stale_running_jobs |
| 4 | commandCenterBand critical → critical risk | risk/rules.test.ts | emits score_in_critical_band |
| 5 | proposal_followups severity by count | risk/rules.test.ts | emits proposal_followups_overdue with severity |
| 6 | dedupeKey on candidates | risk/rules.test.ts | adds dedupeKey to each candidate |
| 7 | Multiple conditions → multiple risks | risk/rules.test.ts | emits multiple risks |
| 8 | Empty context → no actions | next-actions/rules.test.ts | returns empty array |
| 9 | commandCenterBand critical → critical action | next-actions/rules.test.ts | emits score_in_critical_band |
| 10 | Ranking by score | next-actions/rules.test.ts | ranks by score |

---

## API Auth (401 without session)

| Endpoint | Test |
|----------|------|
| GET /api/risk | api-auth.spec.ts |
| POST /api/risk/run-rules | api-auth.spec.ts |
| GET /api/risk/summary | api-auth.spec.ts |
| GET /api/next-actions | api-auth.spec.ts |
| POST /api/next-actions/run | api-auth.spec.ts |
| GET /api/next-actions/summary | api-auth.spec.ts |

---

## Adversarial (400 for bad input)

| Scenario | Endpoint | Test |
|----------|----------|------|
| Invalid action on PATCH | /api/risk/[id] | PATCH invalid action returns 400 |
| Malformed JSON on PATCH | /api/risk/[id] | PATCH malformed JSON returns 400 |
| Snooze without preset/until | /api/risk/[id] | PATCH snooze without preset returns 400 |
| Invalid action on PATCH | /api/next-actions/[id] | PATCH invalid action returns 400 |
| Malformed JSON on PATCH | /api/next-actions/[id] | PATCH malformed JSON returns 400 |

---

## E2E

| Scenario | Test |
|----------|------|
| Risk page loads, Run Risk Rules visible | risk-nba.spec.ts |
| Run Risk Rules triggers API | risk-nba.spec.ts |
| Risk list renders (empty or items) | risk-nba.spec.ts |
| Risk Dismiss (if items) | risk-nba.spec.ts |
| Next Actions page loads, Run visible | risk-nba.spec.ts |
| Run Next Actions triggers API | risk-nba.spec.ts |
| NBA list renders | risk-nba.spec.ts |
| NBA Dismiss (if items) | risk-nba.spec.ts |
| Risk QA page loads | internal-qa.spec.ts |
| Next Actions QA page loads | internal-qa.spec.ts |
| Risk, Next Actions, QA pages in pages.spec | pages.spec.ts |

---

## Run Commands

```bash
# Unit
npm run test -- src/lib/risk/rules.test.ts src/lib/next-actions/rules.test.ts

# E2E (requires dev server)
npm run test:e2e -- tests/e2e/risk-nba.spec.ts tests/e2e/internal-qa.spec.ts tests/e2e/api-auth.spec.ts tests/e2e/internal-api-adversarial.spec.ts
```
