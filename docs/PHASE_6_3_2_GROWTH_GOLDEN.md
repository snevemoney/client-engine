# Phase 6.3.2 — Growth Golden Scenarios + E2E

Regression coverage for the Growth Execution Layer end-to-end: Draft → Send → Follow-up schedule → Mark replied. Overdue follow-up → Growth NBA rule emits → delivery actions work.

---

## Scenario Table

| Scenario | Description | Assertions |
|----------|-------------|------------|
| `golden_growth_draft_creates_draft` | Draft creates OutreachMessage with status draft | 200, draftId, content, placeholders |
| `golden_growth_send_creates_event_and_schedule` | Send creates OutreachEvent.sent + FollowUpSchedule + Deal.nextFollowUpAt | 200, outreachEventId, schedule count 1, deal stage contacted |
| `golden_growth_schedule_followup_updates_schedule_and_deal` | Schedule followup updates FollowUpSchedule and Deal | 200, schedule nextFollowUpAt updated |
| `golden_growth_mark_replied_updates_stage_and_logs_reply` | Mark replied sets stage=replied, logs OutreachEvent.reply | stage replied, reply event exists |
| `golden_growth_overdue_followup_produces_growth_nba_and_execute_schedule_3d` | Overdue schedule triggers growth_overdue_followups NBA; execute schedule 3d | NBA emitted, schedule created/updated |

---

## Route Contracts

| Route | 401 | 400 | 404 | 429 | 200 shape |
|-------|-----|-----|-----|-----|-----------|
| POST /api/internal/growth/outreach/draft | unauthenticated | missing dealId/templateKey, malformed JSON | deal not found | Retry-After | draftId, content, placeholders |
| POST /api/internal/growth/outreach/send | unauthenticated | missing dealId/templateKey/content | deal not found | Retry-After | outreachEventId, messageId, nextFollowUpAt |
| POST /api/internal/growth/followups/schedule | unauthenticated | missing dealId/nextFollowUpAt | deal not found | Retry-After | nextFollowUpAt, cadenceDays |

---

## Commands

```bash
# Unit + golden + route + integration
npm run test -- src/lib/growth/ src/app/api/internal/growth/

# E2E (with dev server or USE_EXISTING_SERVER=1)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e tests/e2e/growth.spec.ts
```

---

## What Breaks If This Fails

- **Golden regression:** Draft/send/schedule/mark-replied flows produce wrong DB state; NBA rules read stale data.
- **Route contracts:** API returns wrong status codes; errors leak sensitive data (Bearer, webhook URLs).
- **NBA integration:** founder_growth scope produces no actions when overdue/no-outreach/stale; delivery actions fail with wrong payload.
- **E2E:** Growth page or next-actions founder_growth scope broken; Run Growth NBA or execute actions fail in production.

---

## Related Files

- `src/lib/growth/golden-scenarios.ts` — Scenario definitions
- `src/lib/growth/test-utils/run-growth-golden.ts` — Seed helpers, snapshot, cleanup
- `src/lib/growth/golden-regression.test.ts` — 5 golden scenarios
- `src/lib/growth/nba-integration.test.ts` — NBA founder_growth integration
- `src/app/api/internal/growth/outreach/draft/route.test.ts`
- `src/app/api/internal/growth/outreach/send/route.test.ts`
- `src/app/api/internal/growth/followups/schedule/route.test.ts`
- `tests/e2e/growth.spec.ts` — E2E flow
