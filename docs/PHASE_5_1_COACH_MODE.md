# Phase 5.1: Coach Mode Copilot

## Overview

Coach Mode is a safe, operator-facing chat that reads the app's current state (scores, risks, NBA) and responds with actionable guidance using **tool-backed data only**—no hallucinations.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Coach UI       │────▶│  POST /api/internal/ │────▶│  Coach Engine   │
│  /dashboard/    │     │  copilot/coach       │     │  (deterministic) │
│  copilot/coach  │     └──────────┬───────────┘     └────────┬────────┘
└─────────────────┘                │                          │
                                   │                          │
                    ┌──────────────▼──────────────┐           │
                    │  Coach Tools (server)       │◀──────────┘
                    │  - getScoreContext          │
                    │  - getRiskContext          │
                    │  - getNBAContext           │
                    │  - runRecomputeScore       │
                    │  - runRiskRules            │
                    │  - runNextActions          │
                    └──────────────┬─────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  Internal APIs              │
                    │  /api/internal/scores/*     │
                    │  /api/risk/*                │
                    │  /api/next-actions/*        │
                    └─────────────────────────────┘
```

## Response Contract

### Input

```json
{
  "message": "string",
  "entityType": "command_center",
  "entityId": "command_center"
}
```

### Output

```json
{
  "reply": {
    "status": "string",
    "diagnosis": "string",
    "topActions": [
      {
        "title": "string",
        "actionKey": "string",
        "nextActionId": "string?",
        "why": "string",
        "evidence": ["string"]
      }
    ],
    "risksOrUnknowns": ["string"],
    "suggestedCommands": ["string"]
  },
  "sources": {
    "score": { "latest": "string", "recentEvents": [...] },
    "risk": { "summary": "string", "top": [...] },
    "nba": { "summary": "string", "top": [...] }
  }
}
```

## Guardrails (Non-Negotiables)

1. **No guessing** — The copilot only makes claims based on data fetched from internal APIs/DB.
2. **Citations required** — Every recommendation includes evidence lines (IDs, timestamps, counts, score/band).
3. **Structured output** — Responses follow the schema: Status → Diagnosis → Top 3 Next Actions → Why (evidence) → Risks/Unknowns → Suggested Commands.
4. **Tool-first behavior** — Before answering, the copilot calls tools to fetch: scores summary + history, risk summary + top open, NBA summary + top queued.
5. **Refusal rules** — If required data is missing or APIs fail, respond with "I can't confirm X yet" + next steps to fetch/compute.

## Tool Layer

| Tool | Calls | Purpose |
|------|-------|---------|
| `getScoreContext` | /api/internal/scores/summary, /history?range=7d | Latest score, band, recent events |
| `getRiskContext` | /api/risk/summary, /api/risk?status=open&pageSize=5 | Open risk counts, top 5 |
| `getNBAContext` | /api/next-actions/summary, /api/next-actions?status=queued&pageSize=5 | Queued counts, top 5 |
| `runRecomputeScore` | POST /api/internal/scores/compute | Trigger score computation |
| `runRiskRules` | POST /api/risk/run-rules | Run risk rules |
| `runNextActions` | POST /api/next-actions/run | Run NBA rules |

## Coach Engine (Deterministic)

- **Step 1:** Fetch contexts (score, risk, nba).
- **Step 2:** Derive diagnosis using rules:
  - Score critical → emphasize score recovery
  - Open critical risks → prioritize risk remediation
  - Queued NBA → pick top 3 with explanations
- **Step 3:** Produce structured output with citations.

No fancy prompt chains. Output is validated with Zod.

## Ops Events

| Event | When |
|-------|------|
| `copilot.coach.requested` | Request received |
| `copilot.coach.context_loaded` | Contexts fetched (scoreOk, riskOk, nbaOk) |
| `copilot.coach.responded` | Success |
| `copilot.coach.failed` | Error (sanitized) |

## Rate Limiting

- 20 requests per minute per user (by `rl:copilot-coach:{clientKey}`).
- Returns 429 with Retry-After header when exceeded.

## Files

| Path | Purpose |
|------|---------|
| `src/lib/copilot/coach-tools.ts` | Tool functions |
| `src/lib/copilot/coach-schema.ts` | Zod schemas |
| `src/lib/copilot/coach-engine.ts` | Deterministic logic |
| `src/app/api/internal/copilot/coach/route.ts` | POST handler |
| `src/app/dashboard/copilot/coach/` | UI page + content |

## Out of Scope (Phase 5.1)

- No memory / conversation history
- No multi-agent
- No LLM for response generation (engine is rule-based)
