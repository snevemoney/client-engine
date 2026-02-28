# Phase 5.3 — File Plan: Coach Mode v3 (Sessions + Citations + Safe Refusal)

## A) Data model (Prisma)

- `prisma/schema.prisma` — Add CopilotSession, CopilotMessage, CopilotActionLog
- `prisma/migrations/YYYYMMDD_copilot_sessions/migration.sql` — Migration

## B) Citations system

- `src/lib/copilot/coach-sources.ts` — CoachSource type, citation builders
- `src/lib/copilot/coach-schema.ts` — Extend TopActionSchema with sources
- `src/lib/copilot/coach-tools.ts` — Return ruleKey/dedupeKey/snapshotId where available
- `src/lib/copilot/coach-engine.ts` — Attach sources to every TopAction, refusal logic

## C) Coach + action routes (session persistence)

- `src/app/api/internal/copilot/coach/route.ts` — Accept sessionId, create/load session, persist messages
- `src/app/api/internal/copilot/coach/action/route.ts` — Require sessionId, persist CopilotActionLog, append coach message

## D) Sessions API

- `src/app/api/internal/copilot/sessions/route.ts` — GET list
- `src/app/api/internal/copilot/sessions/[id]/route.ts` — GET detail
- `src/app/api/internal/copilot/sessions/[id]/close/route.ts` — POST close

## E) Safe refusal rules

- `src/lib/copilot/safe-refusal.ts` — Refusal conditions, structured refusal output
- `src/lib/copilot/coach-engine.ts` — Integrate refusal checks

## F) UI

- `src/app/dashboard/copilot/sessions/page.tsx` — Sessions list + transcript view
- `src/app/dashboard/copilot/coach/CoachContent.tsx` — Session create/load, expandable Evidence with citations
- `src/app/dashboard/copilot/coach/` — Link to sessions from coach

## G) Export

- `src/lib/copilot/session-export.ts` — Markdown export generator
- Used by sessions page "Export summary" button

## H) Tests + docs

- Route tests: coach (persist), action (persist, sessionId required), sessions list/detail/close
- Unit tests: coach-engine (sources on TopActions), safe-refusal
- E2E: create session, run CTA, navigate to sessions, verify action log
- `docs/PHASE_5_3_COACH_SESSIONS_CITATIONS.md`
