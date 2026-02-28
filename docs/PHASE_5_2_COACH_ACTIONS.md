# Phase 5.2 — Coach Mode v2: Action Execution, Preview, and Outcome Logging

Coach Mode moves from advice-only to guided execution. The copilot can run safe actions, show previews, and log outcomes—without memory or learning (Phase 7.x).

---

## Endpoints

### POST /api/internal/copilot/coach/action

**Auth:** Session required (same as internal routes).  
**Rate limit:** 30 requests/minute per client.

**Request body:**

```json
{
  "actionKey": "run_risk_rules | run_next_actions | recompute_score | nba_execute",
  "mode": "preview | execute",
  "entityType": "command_center",
  "entityId": "command_center",
  "nextActionId": "optional (required for nba_execute)",
  "nbaActionKey": "optional (mark_done|snooze_1d|dismiss|don_t_suggest_again_30d)"
}
```

**Response:**

```json
{
  "ok": true,
  "preview": {
    "summary": "...",
    "steps": ["..."],
    "warnings": ["..."]
  },
  "execution": {
    "executionId": "optional",
    "resultSummary": "...",
    "errors": []
  },
  "before": { "score": "...", "risk": "...", "nba": "..." },
  "after": { "score": "...", "risk": "...", "nba": "..." }
}
```

- `preview` — populated when `mode: "preview"`.
- `execution` — populated when `mode: "execute"`.
- `before` — context snapshot before action.
- `after` — context snapshot after action (execute only).

**Validation:**

- `nba_execute` requires `nextActionId` and `nbaActionKey`.

---

## Preview / Execute Flow

1. **Preview:** Client calls with `mode: "preview"`. Returns `preview` (summary, steps, warnings) and `before` context.
2. **Confirm:** User confirms in UI.
3. **Execute:** Client calls with `mode: "execute"`. Returns `execution` (resultSummary, errors), `before`, and `after`.
4. **Display:** UI shows result summary and before/after deltas in the chat thread.

**Preview rules:**

- `run_risk_rules` / `run_next_actions`: preview describes what will be evaluated and what can change.
- `recompute_score`: preview shows scope and inputs it reads.
- `nba_execute`: preview shows status transition and whether it’s reversible.

If preview isn’t meaningful, a minimal preview with warnings is returned.

---

## UI Behavior

On `/dashboard/copilot/coach`:

1. **CTA buttons** appear in coach replies for each top action that has a `cta`.
2. **Click CTA:**
   - If `requiresConfirm`: calls API in preview mode → shows preview card.
   - Else: calls API in execute mode.
3. **Preview card:** Summary, steps, warnings, and “Confirm & Execute” button.
4. **On execute:** Result summary and before/after appear in the chat thread.
5. **Context panel:** Refreshes after execute.

**Test IDs:**

- `coach-cta-{actionKey}` — CTA button
- `coach-preview-card` — preview card
- `coach-confirm-execute` — Confirm & Execute button
- `coach-action-result` — result summary block

---

## Ops Events

| Event | When |
|-------|------|
| `copilot.coach.action.previewed` | Preview mode called |
| `copilot.coach.action.executed` | Execute mode called, success |
| `copilot.coach.action.failed` | Execute mode called, failure |

**Meta (sanitized):** `actionKey`, `mode`, `entityType`, `entityId`, `nextActionId`, `ok`.

---

## Guardrails

- **No hallucinated outcomes.** After execution, contexts are re-fetched and before/after are shown.
- **Rate limit + auth** same as internal routes.
- **Ops events** for every preview/execute with sanitized meta.
- **E2E mutation safety guard** (`requireSafeE2EBaseUrl`) enforced for coach E2E tests.
- **No memory, personalization, or multi-agent work** — Phase 7.x.

---

## Action Keys

| Action Key | Description |
|------------|-------------|
| `run_risk_rules` | Run risk rules engine |
| `run_next_actions` | Run next actions engine |
| `recompute_score` | Recompute operator score |
| `nba_execute` | Execute NBA action (mark_done, snooze_1d, dismiss, don_t_suggest_again_30d) |

---

## Related Files

- `src/lib/copilot/coach-actions.ts` — Action service, preview logic, execute
- `src/app/api/internal/copilot/coach/action/route.ts` — API route
- `src/lib/copilot/coach-schema.ts` — CTA schema
- `src/lib/copilot/coach-engine.ts` — Engine with CTAs
- `src/app/dashboard/copilot/coach/CoachContent.tsx` — UI with CTAs, preview, confirm, result
