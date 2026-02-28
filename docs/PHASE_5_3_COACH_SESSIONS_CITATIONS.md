# Phase 5.3 — Coach Mode v3: Saved Sessions, Citations, and Safe Refusal

Coach Mode becomes auditable and replayable. Every conversation is persisted, every claim cites sources, and the coach refuses safely when context is missing or stale.

---

## Data Model

### CopilotSession

- `id`, `createdAt`, `updatedAt`
- `title` (nullable)
- `entityType`, `entityId` (default: command_center)
- `status` (open | closed)

### CopilotMessage

- `id`, `sessionId`, `createdAt`
- `role`: user | coach | system
- `contentJson`: structured response
- `sourcesJson`: citations list
- `metaJson`: latency, model, etc.

### CopilotActionLog

- `id`, `sessionId`, `createdAt`
- `actionKey`, `mode` (preview | execute)
- `nextActionId`, `nbaActionKey` (nullable)
- `beforeJson`, `afterJson`, `resultJson`
- `status`: success | failed
- `errorMessage` (sanitized)

---

## API

### POST /api/internal/copilot/coach (updated)

- **Body:** `message`, `entityType`, `entityId`, `sessionId` (optional)
- **Behavior:** If no `sessionId`, creates a new session. Persists user message + coach reply as CopilotMessages.
- **Response:** `{ ...CoachResponse, sessionId }`

### POST /api/internal/copilot/coach/action (updated)

- **Body:** `actionKey`, `mode`, `entityType`, `entityId`, **`sessionId` (required)**, `nextActionId`, `nbaActionKey`
- **Behavior:** Requires `sessionId`. On execute, persists CopilotActionLog and appends a coach message summarizing outcomes.
- **404** when session not found.

### GET /api/internal/copilot/sessions

- List recent sessions (title, lastUpdated, scope).
- Auth + rate limit.

### GET /api/internal/copilot/sessions/[id]

- Full session: messages + action logs.
- Auth + rate limit.

### POST /api/internal/copilot/sessions/[id]/close

- Mark session status closed.
- Auth + rate limit.

---

## Citations

Normalized source objects:

| Kind | Fields |
|------|--------|
| `score_snapshot` | id, createdAt |
| `risk_flag` | id, ruleKey |
| `next_action` | id, ruleKey, dedupeKey |
| `api` | route, at |

Every TopAction includes `sources: CoachSource[]`. Unit tests validate each TopAction has ≥1 source.

---

## Safe Refusal

The coach refuses with structured output when:

1. **Score context missing** and user asks for score-based advice
2. **Score stale (>24h)** and user asks "what should I do today?" without recompute
3. **Action execution** attempted with missing identifiers (nba_execute without nextActionId/nbaActionKey)
4. **Tool 401/500** — coach must not claim success; instructs next safe step

Refusal response: `status: "refused"`, `diagnosis` with message, `topActions` with suggested refresh CTA.

---

## UI

### /dashboard/copilot/coach

- Creates/loads session on first message
- Session ID stored and passed to action API
- Expandable "Evidence" sections with citations (sources)
- Link to Sessions page

### /dashboard/copilot/sessions

- Left rail: session list
- Main: selected session transcript
- Action logs rendered as cards with before/after delta
- "Export summary" button: copies markdown to clipboard (diagnosis, actions taken, results, sources)

---

## Export Format

Markdown block includes:

- Diagnosis
- Actions taken (with before/after)
- Open risks/NBA (pointer to context)
- Sources list

---

## Guardrails

- Auth + rate limit on all routes
- `sanitizeErrorMessage` on errors
- No memory/learning beyond session storage
- E2E mutation safety guard for coach tests

---

## Related Files

- `prisma/schema.prisma` — CopilotSession, CopilotMessage, CopilotActionLog
- `src/lib/copilot/session-service.ts` — CRUD
- `src/lib/copilot/coach-sources.ts` — Citation types
- `src/lib/copilot/safe-refusal.ts` — Refusal rules
- `src/lib/copilot/session-export.ts` — Markdown export
- `src/app/dashboard/copilot/sessions/page.tsx` — Sessions UI
