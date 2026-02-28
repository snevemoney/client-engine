# Phase 4.2: NBA Delivery Paths (Action Buttons)

**Turns Next Best Actions from informational into actionable** — buttons trigger real work (or safe placeholders) and record outcomes.

---

## Overview

- **Delivery actions** — Registry of executable actions (mark_done, snooze_1d, recompute_score, etc.).
- **Execution audit** — `NextActionExecution` records each run; NBA stores `lastExecutedAt`, `lastExecutionStatus`.
- **API** — `POST /api/next-actions/[id]/execute` with `{ actionKey }`.
- **Constraints** — Auth (401), validation (400), idempotency/dedupe, rate limit (20/min), ops events, sanitized logging.

---

## Schema Additions

### NextBestAction (new fields)

- `snoozedUntil` (DateTime?) — Snooze parity with Risk; hide until this date.
- `lastExecutedAt`, `lastExecutionStatus`, `lastExecutionErrorCode`, `lastExecutionErrorMessage` — Audit trail.

### NextActionExecution (new model)

- `id`, `nextActionId` (FK), `actionKey`, `status` (success|failed)
- `startedAt`, `finishedAt`, `errorCode`, `errorMessage`, `metaJson`
- Indexes: `nextActionId`, `(actionKey, startedAt)`

---

## Delivery Actions (MVP)

| actionKey | Label | Behavior |
|-----------|-------|----------|
| `mark_done` | Mark done | Calls `completeNextAction` |
| `snooze_1d` | Snooze 1 day | Sets `snoozedUntil` = now + 24h |
| `recompute_score` | Recompute score | Calls `computeAndStoreScore` for NBA scope |
| `run_risk_rules` | Run risk rules | Calls `fetchRiskRuleContext` → `evaluateRiskRules` → `upsertRiskFlags` |
| `run_next_actions` | Run next actions | Regenerates NBAs for NBA scope |
| `retry_failed_deliveries` | Retry failed deliveries | Stub: enqueues `retry_failed_deliveries` job; logs `nba.delivery.stubbed` |

---

## API

### POST /api/next-actions/[id]/execute

**Body:** `{ "actionKey": "mark_done" }`

**Response (200):** `{ "ok": true, "executionId": "..." }`

**Errors:** 401 (no auth), 400 (invalid actionKey), 404 (NBA not found), 429 (rate limit), 500 (server error)

**Rate limit:** 20/min per client

---

## List Route Filter

When `status=queued` or no status filter: **hide snoozed items** (`snoozedUntil > now`). Items with `snoozedUntil` null or past are shown.

---

## Ops Events

- `nba.delivery.executed` — Action ran successfully.
- `nba.delivery.failed` — Action threw.
- `nba.delivery.stubbed` — Stub action (e.g. retry_failed_deliveries) logged only.

---

## Job Type

- `retry_failed_deliveries` — Payload: `{ nextActionId }`. Handler stub logs `nba.delivery.retry_job.stub`.

---

## Deployment Checklist

1. **Migration:** Run `npx prisma migrate deploy` (or `npx prisma db push`) in all environments (staging/prod) to add `NextActionExecution` and the new `NextBestAction` fields.
2. **Env vars:** Phase 4.2 does not add new `.env` variables. Existing vars (e.g. `E2E_EMAIL`, `E2E_PASSWORD` for E2E) remain unchanged.
3. **E2E prod guards:** Specs `risk-nba`, `run-pipeline-leads`, and `score-intake-leads` skip when `PLAYWRIGHT_BASE_URL` includes `evenslouis.ca` to avoid mutating prod. For intentional prod scoring, use `E2E_ALLOW_PROD_SCORE=1`.
