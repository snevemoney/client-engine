# Growth Engine — Golden Scenarios

Revenue-critical execution paths. These must work correctly at all times. If any break, revenue stops.

---

## Golden Scenarios

### 1. Add Prospect → Deal Created

**Flow:** Operator adds a prospect → system creates a Deal in `new` stage linked to the Prospect.

**Route chain:**
- `POST /api/internal/growth/prospects` → creates Prospect + Deal
- Returns `{ prospect, deal }` with deal.stage = "new"

**Contract assertions:**
- 401 if unauthenticated
- 400 if name or platform missing
- 200 with prospect.id and deal.id on success
- Rate limited at 20/min per user

**Test:** `tests/e2e/growth.spec.ts` → "Add prospect creates deal"

---

### 2. Draft Outreach → Review → Send

**Flow:** Operator selects a Deal → drafts outreach from template → reviews draft → sends.

**Route chain:**
1. `POST /api/internal/growth/outreach/draft` → `{ draftId, content, placeholders, nextFollowUpDays }`
2. Operator reviews and edits content
3. `POST /api/internal/growth/outreach/send` → `{ outreachEvent, followUpSchedule? }`

**Contract assertions:**
- Draft: 401, 400 (dealId/templateKey), 404 (deal not found), 200 shape
- Send: 401, 400, 200 + creates OutreachEvent + optional FollowUpSchedule
- No auto-send — operator must explicitly click Send

**Test:** `growth/outreach/draft/route.test.ts`, `growth/outreach/send/route.test.ts`

---

### 3. Follow-Up Schedule → Execution

**Flow:** After outreach, system creates a FollowUpSchedule → appears in NBA queue → operator executes.

**Route chain:**
1. `POST /api/internal/growth/followups/schedule` → creates FollowUpSchedule
2. Growth NBA rules detect due follow-ups → create NextBestActions
3. Operator executes NBA via `/api/next-actions/[id]/execute`

**Contract assertions:**
- Schedule: 401, 400, 200 with schedule.id
- NBA run finds due follow-ups and creates actions
- Execution updates deal.lastContactedAt

**Test:** `growth/followups/schedule/route.test.ts`, `tests/e2e/growth.spec.ts` → "Full flow"

---

### 4. Deals List with Filtering

**Flow:** Operator views deals filtered by stage, due date, search.

**Route chain:**
- `GET /api/internal/growth/deals?stage=outreach_sent&due=overdue&search=...`
- Returns `{ items, total, page, pageSize }`

**Contract assertions:**
- 401 if unauthenticated
- 200 with paginated shape
- stage filter uses DealStage enum
- due filter: overdue (past), today, week
- search: matches prospect name or handle

**Test:** `growth/deals/route.test.ts`

---

### 5. Growth Summary (Dashboard Overview)

**Flow:** Dashboard loads growth summary showing deal counts, pipeline value, overdue follow-ups.

**Route chain:**
- `GET /api/internal/growth/summary` → cached via `withSummaryCache` (15s TTL)

**Contract assertions:**
- 401 if unauthenticated
- 200 with `{ dealsCount, prospectsCount, overdueFollowups, totalValueCad, dealsByStage }`
- Degraded fallback if computation fails (P0.2 applies)

**Test:** `growth/summary/route.test.ts`

---

## Test Coverage Matrix

| Scenario | Unit Test | E2E Test | 401 | 400 | 500 | 200 Shape |
|----------|-----------|----------|-----|-----|-----|-----------|
| Add Prospect | `prospects/route.test.ts` | `growth.spec.ts` | Y | Y | Y | Y |
| Deals List | `deals/route.test.ts` | `growth.spec.ts` | Y | Y | Y | Y |
| Draft Outreach | `outreach/draft/route.test.ts` | — | Y | Y | — | Y |
| Send Outreach | `outreach/send/route.test.ts` | — | Y | Y | — | Y |
| Schedule Follow-up | `followups/schedule/route.test.ts` | `growth.spec.ts` | Y | — | — | Y |
| Growth Summary | `summary/route.test.ts` | — | Y | — | Y | Y |

---

## Revenue Protection Rules

1. **No auto-send:** Outreach drafts MUST be reviewed by operator before sending. There is no "batch send" or "auto-follow-up" feature.
2. **Rate limiting:** All mutation routes limited to 20 requests/min per user.
3. **Degraded mode:** If growth summary fails, return degraded flag (not empty data that looks healthy).
4. **Contract compliance:** All growth routes match shapes defined in `docs/API_CONTRACTS.md`.
5. **E2E coverage:** Full flow tested from prospect creation through NBA execution.
