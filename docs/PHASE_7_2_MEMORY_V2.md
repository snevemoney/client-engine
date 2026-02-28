# Phase 7.2: Memory / Pattern Learning v2

Auto-suppress suggestions, pattern alerts, and weekly trend diffs. Deterministic thresholds, no ML.

## Policy rules and thresholds

### Suppression suggestion (`suppression_30d`)

- **Condition:** `dismissCount >= 3` in last 7d AND `successRate <= 0.25`
- **Confidence:** `min(1, dismissCount / 6)`
- **Evidence:** dismissCount, successRate, total

### Risk alert (`raise_risk`)

- **Condition:** `failureCount >= 2` in last 7d OR `delta >= +3` vs prior 7d
- **Severity:**
  - **critical:** ruleKey in `CRITICAL_RULE_KEYS` and (failureCount >= 2 or delta >= 3)
  - **high:** delta >= 5
  - **medium:** otherwise

### Critical rule keys

- `score_in_critical_band`
- `failed_notification_deliveries`
- `flywheel_won_no_delivery`

## Endpoints

### GET /api/internal/memory/summary?range=7d|30d

Returns:

- `topRecurringRuleKeys`, `topSuccessfulRuleKeys`, `topDismissedRuleKeys`
- `trendDiffs`: `{ recurring, dismissed, successful }` — arrays of `TrendDiff`
- `patternAlerts`: array with `riskFlagExists`
- `policySuggestions`: suppression suggestions with confidence + reasons
- `suggestedSuppressions`: legacy format
- `lastUpdatedAt`, `range`

### POST /api/internal/memory/apply

Body: `{ type: "suppression_30d", ruleKey: string }`

- Creates or updates `NextActionPreference` for 30d suppression (entityType/entityId: command_center)
- Logs `memory.policy.applied`

### POST /api/internal/memory/run

- Runs policy engine, raises pattern RiskFlags
- Rate limit: 5/min
- Optional auto-apply when env flags set (see below)
- Returns: `{ ok, patternAlertsRaised, riskFlagIds, autoApplyEnabled, appliedSuppressions? }`

## Deduplication

- **RiskFlags:** key `pattern:${ruleKey}`, deduped by `dedupeKey` (stable per alert)
- **Notifications:** critical/high only; dedupeKey `risk:pattern:${ruleKey}:${window}` (7d bucket)
- **Suppressions:** one `NextActionPreference` per ruleKey per entity scope

## Suppressions

- Applied via `NextActionPreference` with `ruleKey`, `suppressedUntil` (30d)
- Scope: `entityType: "command_center"`, `entityId: "command_center"`
- NBA delivery filters by preferences before surfacing actions

## Auto-apply mode (optional)

Env:

- `MEMORY_AUTO_APPLY_SUPPRESSIONS=0|1` — default 0
- `MEMORY_AUTO_APPLY_MIN_CONFIDENCE=0.8` — default 0.8

When enabled, `POST /api/internal/memory/run` applies suppressions for suggestions with `confidence >= MEMORY_AUTO_APPLY_MIN_CONFIDENCE`.

## Verification commands

```bash
# Unit tests
npm run test -- src/lib/memory/policy.test.ts

# Route tests
npm run test -- src/app/api/internal/memory/summary/route.test.ts
npm run test -- src/app/api/internal/memory/apply/route.test.ts
npm run test -- src/app/api/internal/memory/run/route.test.ts

# E2E (requires local dev + E2E_EMAIL/E2E_PASSWORD)
npm run test:e2e -- tests/e2e/memory.spec.ts
```
