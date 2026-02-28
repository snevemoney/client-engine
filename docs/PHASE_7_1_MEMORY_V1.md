# Phase 7.1 — Memory / Pattern Learning v1 (Operator Memory)

Operator memory layer: records decisions and outcomes, personalizes NBA ranking, auto-suppresses low-signal items, surfaces patterns in Founder OS.

---

## Purpose

- **Personalize NBA:** Boost what works, downrank what you dismiss
- **Earned suppression:** Auto-suggest when dismiss rate is high
- **Founder OS:** Recurring patterns in weekly review

No ML. Deterministic aggregation only.

---

## Models

### OperatorMemoryEvent

| Field | Type | Purpose |
|-------|------|---------|
| `actorUserId` | string | User who made the decision |
| `sourceType` | enum | nba_execute, nba_dismiss, nba_snooze, copilot_action, risk_resolve, founder_review |
| `entityType`, `entityId` | string? | Optional scope |
| `ruleKey`, `actionKey` | string? | Rule or action key |
| `outcome` | enum | success, failure, neutral |
| `metaJson` | Json | Extra context |

### OperatorLearnedWeight

| Field | Type | Purpose |
|-------|------|---------|
| `actorUserId` | string | User |
| `kind` | enum | rule \| action |
| `key` | string | ruleKey or actionKey |
| `weight` | float | -10 to +10 |
| `statsJson` | Json | totals, successRate, lastSeenAt |

Unique: `(actorUserId, kind, key)`.

---

## Weight Rules

| Event | Outcome | Weight delta |
|-------|---------|---------------|
| NBA execute | success | +1 |
| NBA execute | failure | -1 |
| NBA dismiss | neutral | -0.5 |
| NBA snooze | neutral | -0.25 |
| Founder review (ruleKey in misses/deltas) | neutral | -0.25 |

Weights clamped to [-10, +10].

---

## Ranking Personalization

`src/lib/next-actions/ranking.ts`:

- `score += ruleWeight * 2`
- `score += actionWeight * 1`
- If `ruleWeight <= -3`: add penalty (-3)

Learned weights loaded when `next-actions/run` or `run_next_actions` delivery action runs.

---

## Memory Summary API

### GET /api/internal/memory/summary?range=7d|30d

**Auth:** requireAuth  
**Cache:** 15s

**Response:**

```json
{
  "topRecurringRuleKeys": [{ "ruleKey", "count", "trend" }],
  "topSuccessfulRuleKeys": [{ "ruleKey", "count" }],
  "topDismissedRuleKeys": [{ "ruleKey", "count" }],
  "suggestedSuppressions": [{ "ruleKey", "dismissRate", "dismissCount" }],
  "lastUpdatedAt": "ISO8601",
  "range": "7d"
}
```

`suggestedSuppressions`: ruleKeys with ≥3 events and dismiss rate ≥50%.

---

## Ingestion Hooks

| Source | When | Function |
|--------|------|----------|
| NextActionExecution | After execution created | `ingestFromNextActionExecution(executionId, actorUserId)` |
| NBA dismiss | After dismiss or don_t_suggest_again_30d | `ingestFromNextActionDismiss(nextActionId, actorUserId)` |
| NBA snooze | After snooze_1d | `ingestFromNextActionSnooze(nextActionId, actorUserId)` |
| CopilotActionLog | After addActionLog (mode=execute) | `ingestFromCopilotActionLog(actionLogId, actorUserId)` |
| FounderWeekReview | After PUT week review | `ingestFromFounderWeekReview(weekId, actorUserId)` |

All ingestion is try/catch safe. On failure: log `memory.ingest.failed` ops event.

---

## UI

**Patterns card** on `/dashboard/founder/os/week`:

- Top recurring failure modes (7d)
- Suggested suppressions (high dismiss rate)
- Button "Create 30d suppression" → POST /api/next-actions/preferences

---

## Coach Mode

Coach Mode can reference memory summaries as evidence (via `memory/summary` API). Integration in coach tools is optional for Phase 7.1.

---

## Test Commands

```bash
# Unit
npm run test -- ingest
npm run test -- ranking

# Route
npm run test -- memory/summary

# E2E (with dev server)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/memory.spec.ts
```

---

## Related Files

- `src/lib/memory/ingest.ts` — Ingestion
- `src/lib/memory/weights.ts` — Load learned weights
- `src/lib/next-actions/ranking.ts` — Apply weights
- `src/lib/next-actions/delivery-actions.ts` — Hooks for execute/dismiss/snooze
- `src/app/api/internal/memory/summary/route.ts` — Summary API
- `src/app/dashboard/founder/os/week/page.tsx` — Patterns card
