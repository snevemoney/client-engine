# Phase 7.3: Memory v3 — Outcome Attribution + Learning Quality

Deterministic before/after attribution for NBA and Copilot actions. No ML.

## What attribution is

- **Before context:** score (band, score, updatedAt), risk (openCount, criticalCount, topKeys), NBA (queuedCount, topRuleKeys)
- **After context:** same after action execution
- **Delta:** scoreDelta, bandChange, riskOpenDelta, riskCriticalDelta, nbaQueuedDelta
- **Stored:** `OperatorAttribution` record with beforeJson, afterJson, deltaJson

## Delta semantics

- **scoreDelta:** after.score - before.score (null if no score)
- **bandChange:** { from, to } when band changes (critical → warning → healthy)
- **riskOpenDelta:** change in open risk count
- **riskCriticalDelta:** change in critical risk count
- **nbaQueuedDelta:** change in queued NBA count

**Outcome mapping:**
- **improved:** riskCriticalDelta < 0; band improves; scoreDelta >= 5
- **worsened:** riskCriticalDelta > 0; band worsens; scoreDelta <= -5
- **neutral:** otherwise

## Effectiveness

- **netLiftScore:** weighted sum per ruleKey (bounded -10..+10)
- **topEffectiveRuleKeys:** by netLiftScore (positive)
- **topNoisyRuleKeys:** high dismiss + low/negative lift
- **recommendedWeightAdjustments:** suggested +/− for rule weights

## How effectiveness impacts ranking

- `effectivenessBoost = clamp(netLiftScore, -6, +6)` added to NBA score
- Applied when `effectivenessByRuleKey` is loaded for the actor (last 7d)
- Weights remain bounded; stable tie-breakers

## Hook points

1. **NBA execute** (`runDeliveryAction`): mark_done, recompute_score, run_next_actions, run_risk_rules
2. **Copilot action** (`/api/internal/copilot/coach/action`): run_risk_rules, run_next_actions, recompute_score

## Attribution list API

`GET /api/internal/memory/attribution?range=7d&ruleKey=`

- Optional `ruleKey` filter
- Returns `items` array with id, sourceType, ruleKey, actionKey, occurredAt, delta

## Verification commands

```bash
# Unit tests
npm run test -- src/lib/memory/attribution.test.ts
npm run test -- src/lib/memory/effectiveness.test.ts

# Route tests
npm run test -- src/app/api/internal/memory/summary/route.test.ts

# E2E (requires local dev)
npm run test:e2e -- tests/e2e/memory.spec.ts
```
