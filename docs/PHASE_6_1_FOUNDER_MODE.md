# Phase 6.1 — Founder Mode MVP

Business cockpit that turns existing signals (scores, risks, NBA, pipeline, copilot sessions) into a daily execution plan and weekly review.

---

## Purpose

- **Today's Plan:** Top 3 moves derived from score, risk, NBA
- **Business Health:** Score + 7d delta, risks, NBA queued
- **Pipeline Snapshot:** Leads by stage, stuck >7d, no next step
- **Recent Execution:** Last 10 actions (CopilotActionLog + NextActionExecution)
- **Weekly Review shortcut:** Link to coach sessions

---

## Endpoint

### GET /api/internal/founder/summary

**Query:** `entityType`, `entityId` (default: command_center)

**Response:**

```json
{
  "score": {
    "latest": { "id", "score", "band", "delta", "computedAt" },
    "previous": { "score", "band", "computedAt" },
    "history7d": [{ "id", "score", "band", "computedAt" }]
  },
  "risk": {
    "summary": { "openBySeverity", "lastRunAt" },
    "topOpen5": [{ "id", "title", "severity", "status", "ruleKey" }]
  },
  "nba": {
    "summary": { "queuedByPriority", "lastRunAt" },
    "topQueued5": [{ "id", "title", "reason", "priority", "score", "ruleKey", "dedupeKey" }]
  },
  "pipeline": {
    "byStage": { "NEW": 5, "ENRICHED": 3, ... },
    "stuckOver7d": 2,
    "noNextStep": 1
  },
  "execution": {
    "recentCopilotActions": [{ "id", "actionKey", "status", "createdAt", "sessionId" }],
    "recentNextActionExecutions": [{ "id", "actionKey", "status", "startedAt", "nextActionId", "nextActionTitle" }]
  },
  "system": { "lastJobRuns": [...] },
  "todayPlan": [...],
  "entityType": "command_center",
  "entityId": "command_center"
}
```

**Auth:** requireAuth  
**Cache:** 15s (withSummaryCache)  
**Errors:** sanitizeErrorMessage on 500

---

## Today-Plan Rules

`src/lib/founder/today-plan.ts` — `pickTopMoves({ score, risk, nba })`

1. **Critical risks exist:** 1 move = address top critical risk (run_risk_rules)
2. **Score critical/warning:** 1 move = recompute + remediate (recompute_score)
3. **Otherwise:** Up to 2 moves from top NBA queued (nba_execute)

Each move includes `sources` (CoachSource-compatible).

---

## UI Buttons

- **Run Next Actions** → POST /api/next-actions/run
- **Run Risk Rules** → POST /api/risk/run-rules
- **Recompute Score** → POST /api/internal/scores/compute
- **Execute** (on NBA move) → POST /api/next-actions/[id]/execute
- **Open playbook** → /dashboard/next-actions

---

## Test Commands

```bash
# Unit
npm run test -- today-plan
npm run test -- founder/summary

# E2E (with dev server or USE_EXISTING_SERVER=1)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/founder-mode.spec.ts
```

---

## Related Files

- `src/lib/founder/today-plan.ts` — Move derivation
- `src/app/api/internal/founder/summary/route.ts` — API
- `src/app/dashboard/founder/page.tsx` — UI
