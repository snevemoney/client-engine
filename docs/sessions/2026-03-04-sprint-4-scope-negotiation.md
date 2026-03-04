# Session: Sprint 4 Scope Negotiation and Deal Kit — 2026-03-04

## Goal
Implement scope negotiation and deal kit: new lead statuses (SCOPE_SENT, SCOPE_APPROVED), build regeneration with handoff checklist, and UID-based email ingestion to avoid reprocessing.

## Decisions Made
- **SCOPE_SENT / SCOPE_APPROVED:** New statuses for scope negotiation flow; build API accepts APPROVED or SCOPE_APPROVED for build gate.
- **HANDOFF_CHECKLIST.md:** Generated artifact via `generateHandoffChecklist()`; created on initial build and updated on regeneration; rendered with ChecklistRenderer (client-side checkboxes, no persistence).
- **InternalSetting for UID:** `email_ingestion_last_uid` stores last processed UID; when set, fetch uses `{ uid: '${lastUid+1}:*' }` instead of `{ since, seen: false }` for incremental ingestion.

## What Was Built
- `prisma/schema.prisma` — SCOPE_SENT, SCOPE_APPROVED added to LeadStatus enum
- `src/lib/build/handoffChecklist.ts` — generateHandoffChecklist() for pre-delivery, client comms, handoff, closing sections
- `src/app/api/build/[id]/route.ts` — regeneration path updates scope artifacts and HANDOFF_CHECKLIST.md; accepts APPROVED or SCOPE_APPROVED; creates project + scope artifacts when none exist
- `src/app/dashboard/leads/[id]/page.tsx` — SCOPE_SENT/SCOPE_APPROVED in status options; Build button for APPROVED or SCOPE_APPROVED; Regenerate Specs button when project exists; ChecklistRenderer for HANDOFF_CHECKLIST.md
- `src/workers/email-ingestion.ts` — getLastUid/setLastUid via InternalSetting; UID range fetch with `{ uid: true }` option for ImapFlow

## Key Insights
- ImapFlow `fetch()` requires third parameter `{ uid: true }` when range is a UID range (e.g. `{ uid: '123:*' }`), otherwise it may interpret as sequence numbers.
- Checklist checkboxes are client-side only; persistence would require artifact PATCH or separate model.

## Trade-offs Accepted
- Checklist state not persisted — keeps scope simple; can add later if needed.
- No dedicated SCOPE_SENT → SCOPE_APPROVED API — operator can change status via existing lead PATCH or status dropdown.

## Open Questions
- Should decisionSnoozedUntil be added for Snoozed tab on decisions page?
- Persist checklist checkbox state?

## Next Steps
- [ ] Optional: decisionSnoozedUntil on Lead for Snoozed tab
- [ ] Optional: API for SCOPE_SENT → SCOPE_APPROVED transitions
- [ ] Optional: Persist checklist checkbox state
