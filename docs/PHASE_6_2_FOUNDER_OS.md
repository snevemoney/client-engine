# Phase 6.2 — Founder Operating System

Weekly operating cadence: quarterly goals, weekly plan, and review. Deterministic suggestions from existing data (no LLM).

---

## Purpose

- **Quarter:** Goals + KPI targets
- **Week:** Plan (outcomes, milestones, commitments) + Review (wins, misses, deltas, decisions)
- **Suggestions:** Derived from founder summary, risks, NBA, pipeline — user-confirmed only

---

## Models

| Model | Purpose |
|-------|---------|
| `FounderQuarter` | id, startsAt, endsAt, title, notes |
| `FounderKPI` | quarterId, key, label, targetValue, currentValue, unit |
| `FounderWeek` | weekStart (unique), weekEnd, quarterId?, focusConstraint? |
| `FounderWeekPlan` | weekId, topOutcomesJson, milestonesJson, commitmentsJson |
| `FounderWeekReview` | weekId, winsJson, missesJson, deltasJson, decisionsJson, retroNotes |

Indexes: `(weekStart)`, `(quarterId)`, unique on `weekStart`.

---

## Endpoints

### GET/PUT /api/internal/founder/os/quarter

- **GET:** Returns current quarter (based on today). Uses 15s cache.
- **PUT:** Creates/updates title, notes, dates. Body: `{ title?, notes?, startsAt?, endsAt? }`

### GET/PUT /api/internal/founder/os/quarter/kpis

- **GET:** Returns KPIs for current quarter (or `?quarterId=...`). 15s cache.
- **PUT:** Upsert KPIs. Body: `{ kpis: [{ key, label, targetValue, currentValue?, unit? }] }`

### GET/PUT /api/internal/founder/os/week?weekStart=YYYY-MM-DD

- **GET:** Returns week + plan + review. 15s cache. `weekStart` defaults to current week (Monday).
- **PUT:** Updates focusConstraint, plan, review. Body: `{ focusConstraint?, plan?: { topOutcomes, milestones, commitments }, review?: { wins, misses, deltas, decisions, retroNotes } }`

### POST /api/internal/founder/os/week/suggest

- **Rate limit:** 10/min per client
- **Response:** `{ topOutcomes, milestones, focusConstraint }` — deterministic from founder summary, risks, NBA, pipeline
- No LLM. Suggestions include `sources` (CoachSource-compatible) and `id`/`dedupeKey` for traceability.

---

## Suggestion Rules

`src/lib/founder/os/suggest-week.ts` — `buildWeekSuggestions(input)`

1. **Top 3 outcomes:** From highest-impact unresolved risks, top NBA, pipeline stalls (stuck >7d, no next step)
2. **Milestones:** From NBA titles + risk remediation (specific, measurable)
3. **Focus constraint:** Most common ruleKey from risks + NBA

Each outcome includes `sources` (CoachSource-compatible). Deduplication by `risk:id`, `nba:dedupeKey`, `pipeline:stuck_over_7d`, `pipeline:no_next_step`.

---

## UI Pages

| Path | Purpose |
|------|---------|
| `/dashboard/founder/os` | Hub: current quarter, current week status, Open this week, Generate suggestions |
| `/dashboard/founder/os/week` | Week plan + review editor. Generate suggestions shows preview before apply. |
| `/dashboard/founder/os/quarter` | Edit quarter dates/title/notes, KPI table |

---

## Migration

```bash
npx prisma migrate deploy
# or for dev: npx prisma migrate dev --name add_founder_os_models
```

Migration: `prisma/migrations/20260301_add_founder_os_models/migration.sql`

---

## Test Commands

```bash
# Unit
npm run test -- suggest-week
npm run test -- founder/os

# Route
npm run test -- founder/os/quarter
npm run test -- founder/os/week
npm run test -- founder/os/week/suggest

# E2E (with dev server or USE_EXISTING_SERVER=1)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/founder-mode.spec.ts
```

---

## Related Files

- `src/lib/founder/os/suggest-week.ts` — Suggestion logic
- `src/lib/founder/os/week-utils.ts` — Week/quarter date helpers
- `src/app/api/internal/founder/os/quarter/route.ts`
- `src/app/api/internal/founder/os/quarter/kpis/route.ts`
- `src/app/api/internal/founder/os/week/route.ts`
- `src/app/api/internal/founder/os/week/suggest/route.ts`
- `src/app/dashboard/founder/os/page.tsx` — Hub
- `src/app/dashboard/founder/os/week/page.tsx` — Week editor
- `src/app/dashboard/founder/os/quarter/page.tsx` — Quarter editor
