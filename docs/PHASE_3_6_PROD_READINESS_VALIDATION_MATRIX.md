# Phase 3.6: Production Readiness Validation Matrix (Master Coverage Matrix)

**Single source of truth** for production readiness validation. Grounded in actual codebase and tests as of Phase 3.6.1.

---

## Coverage Summary

| Status | Count | % |
|--------|-------|---|
| **PASS** | 64 | 97 |
| **PARTIAL** | 2 | 3 |
| **MISSING** | 0 | 0 |
| **Total** | 66 | 100 |

### Phase 3.6.6 Execution (2026-02-22)

| Suite | Result | Notes |
|-------|--------|-------|
| Unit/integration (release-gating) | ✅ 145 passed | scoring, scores, notifications, ops-events, api/internal |
| Golden regression | ✅ 9 passed | golden-regression.test, golden-replay.route.test |
| E2E prod-readiness | ⚠️ FAIL | Internal routes return 404 on live server; blocked |
| **GO/NO-GO** | **NO-GO** | See docs/releases/phase-3.6.6-go-no-go.md |

### Top Risk Gaps (Resolved)

1. ~~**Notification adapter failure path**~~ — ✅ service.test.ts "24: adapter send() throws" (Matrix #24).
2. ~~**Invalid channel configJson**~~ — ✅ service.test.ts "25: invalid channel configJson" (Matrix #25).
3. ~~**General notification dedupe/retry**~~ — ✅ service.test.ts "26: retry backoff", "27: in-app delivery dedupe" (Matrix #26, #27).
4. ~~**Stale-data UI path**~~ — ✅ DataFreshnessIndicator.test.tsx "61: shows Stale warning", scoreboard.spec "Matrix #60" (Matrix #60, #61).
5. **Bearer auth with existing server** — Bearer tests skip on 401; require `RESEARCH_CRON_SECRET` in .env when using existing server (Matrix #41, #42 — PARTIAL).

### Phase 3.6.2 Adversarial Coverage (Added)

- **sanitizeErrorMessage** — Redacts Bearer tokens, webhook URLs, API key patterns in error messages (ops-events/sanitize.test.ts).
- **Compute route** — Type validation (entityType/entityId must be strings); malformed JSON fragments; wrong types (number, array).
- **Alerts preferences PUT** — Unknown keys stripped; invalid events/booleans; cooldownMinutes as string; very large cooldown; malformed JSON; oversized payload with junk ignored.
- **History/latest/summary** — Missing range uses default; summary without params returns 200 with defaults.
- **Repeated submission** — Rapid recompute (compute-and-store "rapid repeated recompute"); repeated preference saves (alerts prefs route.test "repeated saves").
- **Bearer auth** — Wrong token returns 401 (api-auth.spec.ts).
- **Notifications security** — Nested Authorization header redaction (security.test.ts).

### Phase 3.6.3 Workflow Replay Matrix

| Scenario | Trigger | DB Result | Score Event | Notification | API Response | UI State | Coverage |
|----------|---------|-----------|-------------|--------------|--------------|----------|----------|
| **Normal recompute** | Compute, no band change | Snapshot, delta | None | None | 200, eventsCreated [] | Card updates | compute-and-store "normal recompute no event" |
| **Sharp-drop path** | 85→65 (delta -20) | Snapshot, delta | sharp_drop, fromScore/toScore/delta | Created or suppressed | 200 | — | compute-and-store "sharp_drop full payload" |
| **Recovery path** | critical→healthy | Snapshot | recovery | Created or suppressed | 200 | — | compute-and-store "recovery full payload" |
| **Threshold breach** | warning→critical | Snapshot | threshold_breach | Created or suppressed | 200 | — | compute-and-store "threshold_breach" |
| **Cooldown suppression** | Prior notif within window | ScoreEvent stored | Event stored | Suppressed | — | — | compute-and-store "cooldown suppresses" |
| **Event persistence contract** | enabled: false, compute breach | ScoreEvent stored | Event stored | NOT created | — | — | compute-and-store "event persistence when suppressed" |
| **Rapid recompute** | 5x compute same entity | 5 snapshots | No duplicate events | Cooldown/dedupe bounded | — | Stable | compute-and-store "rapid repeated recompute" |
| **API chain replay** | Compute → latest/history/summary | — | — | — | latest=newest, history has events | — | replay-integration.test |
| **Recompute UI** | Click Recompute | — | — | — | — | Disabled→enabled, score card, data-freshness | scoreboard-workflow-replay.spec |
| **Stale boundary** | computedAt 24h+ | — | — | — | — | Stale badge | DataFreshnessIndicator.test |

### Phase 3.6.4 Failure Injection (Resilience)

| Scenario | Trigger | Injected Failure | API Result | DB Result | UI Result | Coverage |
|----------|---------|------------------|------------|-----------|-----------|----------|
| Adapter send() throws | dispatch delivery | Adapter throws | — | Delivery failed, errorCode/errorMessage | — | service.test #24 |
| Score event persists when delivery fails | Compute breach → dispatch | Adapter throws | — | ScoreEvent + Snapshot intact | — | compute-and-store "resilience: score persists when delivery fails" |
| Invalid configJson | dispatch | configJson array | — | Safe, no crash | — | service.test #25 |
| Compute throws | POST compute | computeAndStoreScore throws | 500, sanitized | — | — | compute route uses sanitizeErrorMessage |
| Summary/history/latest DB fail | GET | DB throws | 500, sanitized | — | score-error visible | Route try/catch + E2E route intercept |
| Alerts PUT DB fail | PUT preferences | update throws | 500, sanitized | — | alerts-prefs-error, save re-enabled | E2E route intercept |
| Metrics-summary DB fail | GET metrics | getMetricsSummary throws | 500, sanitized | — | — | Route try/catch |

### Phase 3.6.5 Golden Scenarios (Regression Fixtures)

| Scenario | Input Fixture | Expected DB Writes | Expected API Outputs | Expected UI | Coverage |
|----------|---------------|---------------------|------------------------|-------------|----------|
| golden_healthy_no_event | 70→72 healthy | Snapshot, delta 2 | — | — | golden-regression.test |
| golden_threshold_breach_to_critical | 60→40 warning→critical | Snapshot, threshold_breach event, notification | summary.latest band/score, recentEvents | — | golden-regression, golden-replay.route.test |
| golden_sharp_drop_notification | 85→65 healthy→warning | Snapshot, sharp_drop event, notification | — | — | golden-regression.test |
| golden_recovery_to_healthy | 45→85 critical→healthy | Snapshot, recovery event, notification | summary/history recovery event | — | golden-regression, golden-replay.route.test |
| golden_notification_suppressed_by_preferences | enabled: false, 60→40 | ScoreEvent, no NotificationEvent | — | — | golden-regression.test |
| golden_notification_suppressed_by_cooldown | Prior notif, 60→46 | ScoreEvent, 1 NotificationEvent (pre-inserted) | — | — | golden-regression.test |
| Empty state golden | No data | — | — | Empty CTA visible, no crash | scoreboard.spec "3.6.5" |
| Recompute golden | Click Recompute | — | — | Button disables→enables, card/empty, trend/range | scoreboard.spec "3.6.5" |
| Error golden | Summary 500 | — | — | score-error, shell usable | scoreboard.spec "3.6.5" |

---

## Route Inventory

| Route | Auth | Happy Path | Validation | Failure / Sanitization |
|-------|------|------------|------------|------------------------|
| `POST /api/internal/scores/compute` | ✅ api-auth 401 | ✅ compute-and-store, compute route.test | ✅ internal-api-adversarial (missing/invalid params, invalid JSON, malformed fragments, wrong types) | ✅ sanitizeErrorMessage redacts secrets; route validates string types |
| `GET /api/internal/scores/latest` | ✅ api-auth 401 | ✅ latest route.test (vitest) | ✅ internal-api-adversarial (missing params) | N/A (no error path) |
| `GET /api/internal/scores/history` | ✅ api-auth 401 | ✅ history route.test | ✅ internal-api-adversarial (missing params, invalid range) | N/A |
| `GET /api/internal/scores/summary` | ✅ api-auth 401 | ✅ summary route.test | ✅ internal-api-adversarial (no params → 200 with defaults) | N/A |
| `GET /api/internal/scores/alerts/preferences` | ✅ api-auth 401 | ✅ E2E score-alerts, prod-readiness Workflow 3 | N/A (GET) | N/A |
| `PUT /api/internal/scores/alerts/preferences` | ✅ api-auth 401 | ✅ alerts preferences route.test | ✅ internal-api-adversarial (invalid cooldown, invalid JSON, empty body, unknown keys, wrong types, oversized) | 3.6.2 |
| `GET /api/internal/ops/metrics-summary` | ✅ api-auth 401 | ✅ internal-api-adversarial (24h, 7d shape) | ✅ internal-api-adversarial (invalid period → 400) | ✅ asserts no DATABASE_URL/SECRET/PASSWORD |
| `GET /api/internal/system/check` | ✅ api-auth 401 | ✅ internal-api-adversarial (shape, health booleans) | N/A | ✅ asserts no secrets |

---

## Workflow Replay Inventory

| Workflow | E2E | Integration/Unit | Notes |
|----------|-----|------------------|-------|
| **Recompute → snapshot → score event** | prod-readiness Workflow 1, 2; scoreboard.spec "3.6.3 Workflow replay" | compute-and-store.test, replay-integration.test | 3.6.3 |
| **Sharp drop path** | Implicit in recompute | compute-and-store.test "creates sharp_drop event" | ✅ |
| **Recovery path** | Implicit | compute-and-store.test "creates recovery event" | ✅ |
| **Threshold breach path** | Implicit | compute-and-store.test "creates threshold_breach event" | ✅ |
| **Score event → notification** | Implicit | compute-and-store "creates notification event", "score event still created when notification suppressed" | ✅ |
| **Cooldown suppression** | E2E cooldown persist (Workflow 3, score-alerts) | notification-cooldown.test, compute-and-store "cooldown suppresses notification" | ✅ |
| **Preference disabled suppression** | Implicit | alerts-preferences.test "global disabled", compute-and-store "notification suppressed by preferences" | ✅ |
| **Dedupe behavior** | — | compute-and-store "does not create duplicate event", "dedupe prevents repeated notifications" | ✅ Unit only |
| **Stale-data UI path** | scoreboard.spec "Matrix #60" | DataFreshnessIndicator.test "61: shows Stale warning" | ✅ |
| **Empty-state path** | prod-readiness Workflow 5, scoreboard "empty state shows CTA" | — | ✅ |

---

## Master Validation Matrix

### Category: Scoring Workflows

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 1 | Valid compute | POST { entityType, entityId } | 200, { snapshotId, score, band, delta, eventsCreated } | ScoreSnapshot, ScoreEvent(s) | Score card updates | withRouteTiming | compute-and-store.test, compute route.test, prod-readiness Workflow 1 | — | PASS | |
| 2 | Delta when previous exists | Second compute same entity | 200, delta numeric | New snapshot, delta = current − previous | — | — | compute-and-store.test "computes delta" | — | PASS | |
| 3 | Threshold breach event | Band crosses → critical | 200 | ScoreEvent (threshold_breach), NotificationEvent if enabled | — | — | compute-and-store.test "creates threshold_breach event" | — | PASS | |
| 4 | Sharp drop event | Delta ≤ −15 | 200 | ScoreEvent (sharp_drop) | — | — | compute-and-store.test "creates sharp_drop event" | — | PASS | |
| 5 | Recovery event | Band crosses → healthy | 200 | ScoreEvent (recovery) | — | — | compute-and-store.test "creates recovery event" | — | PASS | |
| 6 | Missing entityType/entityId | POST with missing param | 400, { error } | None | — | — | internal-api-adversarial "missing entityType/entityId" | — | PASS | |
| 7 | Invalid entityType | POST entityType invalid | 400 | None | — | — | internal-api-adversarial "invalid entityType" | — | PASS | |
| 8 | Invalid JSON body | POST body "not json" | 400 | None | — | — | internal-api-adversarial "invalid JSON" | — | PASS | |
| 9 | Compute 500 error path | Internal throw | 500, sanitized message | Depends (may have partial writes) | — | sanitizeErrorMessage used | compute route uses sanitizeErrorMessage | — | PASS | |

### Category: Score Alerts Preferences

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 10 | GET preferences | GET /alerts/preferences | 200, { enabled, events, cooldownMinutes, ... } | None | — | — | api-auth, E2E score-alerts | — | PASS | |
| 11 | PUT valid cooldown | PUT { cooldownMinutes: 90 } | 200, updated prefs | InternalSetting upsert | Saved toast, value persists on reload | — | prod-readiness Workflow 3, score-alerts "cooldown save persists" | — | PASS | waitForResponse on PUT |
| 12 | PUT invalid cooldown (-1) | PUT { cooldownMinutes: -1 } | 400 | None | — | — | internal-api-adversarial | — | PASS | |
| 13 | PUT cooldown > 1440 | PUT { cooldownMinutes: 9999 } | 400 | None | — | — | internal-api-adversarial | — | PASS | |
| 14 | PUT invalid JSON | PUT body "not json" | 400 | None | — | — | internal-api-adversarial | — | PASS | |
| 15 | PUT empty body | PUT {} | 400 "No valid fields" | None | — | — | internal-api-adversarial | — | PASS | |
| 16 | Global disabled | enabled: false | — | — | shouldEmit → false, reason global_disabled | — | alerts-preferences.test "global disabled suppresses all" | — | PASS | |
| 17 | Event-specific disabled | events.threshold_breach: false | — | — | shouldEmit → false, reason event_disabled | — | alerts-preferences.test "event-specific disabled" | — | PASS | |
| 18 | sharpDropMinDelta | Delta below min | — | — | shouldEmit → false, reason below_min_delta | — | alerts-preferences.test "sharpDropMinDelta threshold" | — | PASS | |

### Category: Notification Suppression

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 19 | Preference disabled suppresses notification | enabled: false, compute causes event | — | ScoreEvent created, NotificationEvent NOT created | — | — | compute-and-store "score event still created when notification suppressed" | — | PASS | |
| 20 | Cooldown suppresses notification | Prior notification within window, same entity/eventType | — | ScoreEvent created, no new NotificationEvent | — | — | compute-and-store "cooldown suppresses", notification-cooldown.test | — | PASS | |
| 21 | Cooldown 0 → no suppression | cooldownMinutes: 0 | — | New notification allowed | — | — | notification-cooldown.test "cooldown disabled (0)" | — | PASS | |
| 22 | Cooldown different eventType → allow | Prior notification for sharp_drop, new threshold_breach | — | New notification allowed | — | — | notification-cooldown.test "cooldown active but different eventType" | — | PASS | |
| 23 | Dedupe same event type | Repeat compute within dedupe window | — | Single NotificationEvent | — | — | compute-and-store "dedupe prevents repeated notifications" | — | PASS | |
| 24 | Adapter send() throws | Simulated | — | Delivery failed, errorCode/errorMessage stored | — | Sanitized | service.test "24: adapter send() throws" | — | PASS | |
| 25 | Invalid channel configJson | Malformed config | — | Safe failure, no throw | — | No secret leak | service.test "25: invalid channel configJson" | — | PASS | |
| 26 | Retry backoff fields | Delivery fails | — | attempt, runAfter, maxAttempts set | — | — | service.test "26: retry backoff" | — | PASS | |
| 27 | In-app delivery dedupe | Duplicate in-app | — | Single in-app notification | — | — | service.test "27: in-app delivery dedupe" | — | PASS | |

### Category: Internal Ops / Metrics Summary

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 28 | GET metrics 24h | GET ?period=24h | 200, { period, notifications, deliveries, escalations, jobs } | None | Notifications QA shows | — | internal-api-adversarial | — | PASS | |
| 29 | GET metrics 7d | GET ?period=7d | 200, same shape | None | — | — | internal-api-adversarial | — | PASS | |
| 30 | GET metrics invalid period | GET ?period=30d | 400 | None | — | — | internal-api-adversarial | — | PASS | |
| 31 | jobs.staleRunning numeric | — | Number, not null | — | — | — | internal-api-adversarial | — | PASS | |
| 32 | No secrets in response | — | No DATABASE_URL, SECRET, PASSWORD | — | — | — | internal-api-adversarial | — | PASS | |
| 33 | Empty DB / no data | Fresh DB | Zero values, no null explosions | — | — | — | metrics.test.ts | — | PASS | |

### Category: System Check

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 34 | GET system/check | GET | 200, { health: { hasInAppChannel, hasBaselineEscalationRule, queueConfigured, internalRoutesProtected }, scoreAlerts?, ... } | None | Notifications QA | — | internal-api-adversarial | — | PASS | |
| 35 | No secrets in response | — | Booleans/status only | — | — | — | internal-api-adversarial | — | PASS | |

### Category: Internal QA Pages

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 36 | Notifications QA loads | Navigate to /dashboard/internal/qa/notifications | — | — | Checklist, Refresh button, system check/metrics sections | — | internal-qa.spec, prod-readiness Workflow 4 | — | PASS | |
| 37 | Scores QA loads | Navigate to /dashboard/internal/qa/scores | — | — | Compute button, latest/history | — | internal-qa.spec, prod-readiness Workflow 4 | — | PASS | |
| 38 | Prod Readiness QA loads | Navigate to /dashboard/internal/qa/prod-readiness | — | — | Links to Notifications QA, Scores QA | — | prod-readiness-workflows "Prod readiness page loads" | — | PASS | data-testid selectors |
| 39 | Scores QA compute button | Click Compute | — | Snapshot/events if data | Latest score or "No score data" | — | internal-qa "Score QA page loads and compute works" | — | PASS | |

### Category: Auth Protection

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 40 | No session → 401 | Request without cookie | 401 | None | — | — | api-auth.spec (all internal routes) | — | PASS | |
| 41 | Bearer workday-run | POST with Bearer RESEARCH_CRON_SECRET | 200 or 500 (not 401) | — | — | — | api-auth.spec | — | PARTIAL | Requires RESEARCH_CRON_SECRET in server env |
| 42 | Bearer research/run | POST with Bearer RESEARCH_CRON_SECRET | 200 or 500 (not 401) | — | — | — | api-auth.spec | — | PARTIAL | Same as above |
| 43 | No Bearer → 401 | POST workday-run/research/run without auth | 401 | None | — | — | api-auth.spec | — | PASS | |

### Category: Adversarial API Validation

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 44 | history missing entityType | GET without entityType | 400 | None | — | — | internal-api-adversarial | — | PASS | |
| 45 | history missing entityId | GET without entityId | 400 | None | — | — | internal-api-adversarial | — | PASS | |
| 46 | history invalid range | GET range=invalid | 200, clamped to 7d | — | — | — | internal-api-adversarial | — | PASS | |
| 47 | latest missing params | GET without entityType or entityId | 400 | None | — | — | internal-api-adversarial | — | PASS | |
| 48 | Error response no stack/secrets | Any 400 | { error: string }, no stack, no Bearer/sk_ | — | — | — | internal-api-adversarial "error response shape" | — | PASS | |

### Category: Sanitization / Security

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 49 | sanitizeMeta redacts apiKey | Object with apiKey | [redacted] | — | — | — | ops-events/sanitize.test | — | PASS | |
| 50 | sanitizeMeta redacts configJson | Object with configJson | [redacted] | — | — | — | ops-events/sanitize.test | — | PASS | |
| 51 | sanitizeMeta redacts webhook_url | Object with webhook_url | [redacted] | — | — | — | ops-events/sanitize.test | — | PASS | |
| 52 | sanitizeErrorMessage truncates | Long error | Max 500 chars | — | — | — | ops-events/sanitize.test | — | PASS | |
| 53 | Notification meta log-safe | Score notification payload | No redacted in safe payload | — | — | — | compute-and-store "meta shape is log-safe" | — | PASS | |
| 54 | notifications/sanitize | token, authorization, etc. | [redacted] | — | — | — | notifications/sanitize.test | — | PASS | |

### Category: Scoreboard UI States

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 55 | Empty state | No snapshots | summary returns null latest | None | CTA, recompute-empty-cta visible | — | scoreboard "empty state", prod-readiness Workflow 5 | — | PASS | |
| 56 | Loaded state | Has snapshots | summary returns latest | — | Score card, trend, factors | — | scoreboard, prod-readiness Workflow 1 | — | PASS | |
| 57 | Recompute click | Click recompute | Compute POST 200 | Snapshot, events | Button disabled, then enabled; card/empty/error visible | — | scoreboard, prod-readiness Workflow 1 | — | PASS | |
| 58 | Range selector | 7d, 24h, 30d | History with range | — | range-7d, range-24h, range-30d visible | — | scoreboard "Range selector visible" | — | PASS | |
| 59 | Factor changes / empty | Has or no factors | — | — | score-factor-changes or score-factor-changes-empty | — | scoreboard, prod-readiness Workflow 1 | — | PASS | |
| 60 | Data freshness indicator | Has latest | — | — | data-freshness visible when data | — | scoreboard.spec "Matrix #60", DataFreshnessIndicator.test | — | PASS | |
| 61 | Stale warning (>24h) | computedAt > 24h ago | — | — | Stale warning in DataFreshnessIndicator | — | DataFreshnessIndicator.test "61: shows Stale warning" | — | PASS | |
| 62 | Alerts summary chip | Has prefs | — | — | alerts-summary-chip visible, "Alerts:" | — | score-alerts "alerts summary chip" | — | PASS | |

### Category: History / Latest / Summary Routes

| # | Workflow / Scenario | Trigger / Input | Expected API Response | Expected DB Writes | Expected UI Result | Ops Logs | Automated Coverage | Manual | Status | Notes |
|---|---------------------|-----------------|----------------------|--------------------|--------------------|----------|--------------------|--------|--------|-------|
| 63 | summary defaults | GET without params | 200, entityType=command_center, entityId=command_center | — | — | — | Route uses ?? default | — | PASS | No validation test; by design |
| 64 | history shape | GET with valid params | { timeline, events } | — | — | — | history route.test (implicit in E2E) | — | PASS | |
| 65 | latest shape | GET with valid params | { latest, previous, recentEvents } | — | — | — | latest route.test | — | PASS | |
| 66 | summary shape | GET with valid params | { latest, previous, previousFactorSummary, recentEvents } | — | — | — | summary route.test | — | PASS | |

---

## Known Caveats / Test Preconditions

| Item | Detail |
|------|--------|
| **RESEARCH_CRON_SECRET** | Playwright config sets fallback `e2e-cron-secret-for-playwright` when unset. For Bearer tests to pass: (a) When Playwright starts the server (CI), fallback is passed to webServer env. (b) When using `USE_EXISTING_SERVER=1`, the server must have RESEARCH_CRON_SECRET in .env (see .env.example). |
| **Server startup** | Playwright starts `npm run dev` when baseURL is localhost and `USE_EXISTING_SERVER` is not set. With `USE_EXISTING_SERVER=1`, uses existing server. |
| **Seeded data** | E2E login requires ADMIN_EMAIL/ADMIN_PASSWORD or E2E_EMAIL/E2E_PASSWORD. Score compute uses real DB; empty state when no snapshots. |
| **Preferences save** | prod-readiness Workflow 3 uses `page.waitForResponse` for PUT 200 before reload to avoid race. |
| **Selectors** | E2E uses `data-testid` (recompute-button, score-card, alerts-prefs-link, etc.) and role/heading for stability. |
| **internal-qa Checklist** | Uses exact "Checklist" for h2; "Notifications QA Checklist" for h1 to avoid strict mode violation. |

---

## Manual Pass/Fail Checklist (Prod Verification)

- [ ] Auth: All internal routes return 401 without session
- [ ] DB schema applied (migrations run)
- [ ] Seeds/default settings present (score_alerts_preferences, channels)
- [ ] System check returns expected booleans; no secrets
- [ ] Metrics summary returns expected keys; no secrets
- [ ] Score compute → event → notification (or suppression) flow works
- [ ] Alerts preferences persist; cooldown respected
- [ ] E2E smoke passed
- [ ] No unsanitized errors in responses/logs
- [ ] Bearer RESEARCH_CRON_SECRET works (when configured)
