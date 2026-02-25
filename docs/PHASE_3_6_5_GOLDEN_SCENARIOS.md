# Phase 3.6.5: Golden Scenarios (Regression Fixtures)

Canonical score/notification flows encoded as reusable fixtures. Run before deploy to catch regressions.

---

## Purpose

- **Deterministic** inputs/outputs for core flows
- **Repeatable** pre-prod validation
- **Fast** — small set of canonical scenarios, not broad fuzzing

---

## Scenarios

| ID | Name | Verifies |
|----|------|----------|
| `golden_healthy_no_event` | Healthy → healthy (small change) | No event, no notification, snapshot persists |
| `golden_threshold_breach_to_critical` | Warning → critical | threshold_breach event, notification, payload contract |
| `golden_sharp_drop_notification` | Healthy → warning (sharp drop) | sharp_drop event, notification, fromScore/toScore/delta/bands/dedupeKey |
| `golden_recovery_to_healthy` | Critical → healthy | recovery event, notification |
| `golden_notification_suppressed_by_preferences` | Event created, notification suppressed | Score event stored, no notification event/delivery |
| `golden_notification_suppressed_by_cooldown` | Prior notification exists | Event created, no duplicate notification |

---

## Commands

### Unit/integration golden tests

```bash
npm run test -- src/lib/scoring/golden-regression.test.ts
```

### API route golden tests

```bash
npm run test -- src/app/api/internal/scores/golden-replay.route.test.ts
```

### E2E golden smoke

Requires app running (`npm run dev` in another terminal):

```bash
npm run test:e2e tests/e2e/scoreboard.spec.ts --grep "3.6.5"
```

### Run all golden-related tests

```bash
npm run test -- src/lib/scoring/golden-regression.test.ts src/app/api/internal/scores/golden-replay.route.test.ts
```

---

## Adding a New Scenario

1. Add to `src/lib/scoring/golden-scenarios.ts`:
   - `id`, `name`, `description`
   - `priorSnapshot` (optional)
   - `currentOverride` (score, band)
   - `preferencesOverride` (optional)
   - `expected` (score, band, delta, scoreEventTypes, notificationExpected, etc.)

2. Add a test in `src/lib/scoring/golden-regression.test.ts`:
   - Call `runGoldenScenario(scenarioId)`
   - Assert key contracts (score, band, event types, notification count)

3. Update `GOLDEN_SCENARIOS` and the aggregate test will include it.

---

## Fixture Rules

- **Deterministic** — use `_testOverride` for score/band; avoid flaky timestamps
- **Explicit expectations** — score, band, delta, event types, notification count
- **No exact timestamps** — avoid asserting `createdAt` / `computedAt` values
- **Key contracts only** — fromScore, toScore, delta, bands, dedupeKey; not entire JSON blobs
- **Seed prior snapshot** when testing delta/event transitions
