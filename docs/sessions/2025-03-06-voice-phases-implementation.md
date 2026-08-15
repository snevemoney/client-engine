# Session: Voice Phases Implementation + Browser Test

**Date:** 2025-03-06  
**Goal:** Complete Voice Phases 2–5, add missing Phase 3 UI, review all phases, test in browser.

## What Was Done

### Phase 3 UI (completed)

1. **Proposal follow-ups page** (`/dashboard/proposal-followups`)
   - Extended `ProposalFollowupItem` with `voiceConsentAt`, `contactPhone`
   - Added "Schedule voice" button for `voice_eligible` bucket
   - Added "Consent" button for proposals with `contactPhone` but no `voiceConsentAt` (stale/overdue buckets)
   - Handlers: `handleConsent` → POST `/api/voice/consent`, `handleScheduleVoice` → POST `/api/voice/schedule-follow-up`

2. **Proposal detail page** (`/dashboard/proposals/[id]`)
   - Voice follow-up section when status is sent/viewed and proposal has contactPhone or voice fields
   - "Record consent" button when no consent
   - "Opt out" button when consented
   - Proposal API extended to return `contactPhone`, `voiceConsentAt`, `voiceOptedOutAt`

3. **Voice call log page** (`/dashboard/voice/calls`)
   - New GET `/api/voice/calls` with pagination
   - Table: Called, Proposal (link), Phone, Outcome, Duration
   - Link back to voice eligible proposals

4. **Sidebar**
   - Added "Voice calls" nav item (Convert group) with Phone icon

### API Changes

- `GET /api/proposals/followups` — select now includes `voiceConsentAt`, `contactPhone`
- `GET /api/proposals/[id]` — response includes `contactPhone`, `voiceConsentAt`, `voiceOptedOutAt`
- `GET /api/voice/calls` — new route for paginated call log

### Browser Test Results

- **Command Center:** Voice follow-ups card renders (shows "Loading…" initially; metrics API works)
- **Proposal follow-ups:** Page loads; bucket buttons include "Voice eligible"; encountered 500 on initial load (Prisma `voiceConsentAt` field error — fixed by adding migration `20260309_add_voice_schema` and clearing `.next`)
- **Voice call log:** Page loads, shows "Loading…" then empty state ("No voice calls yet")
- **Sidebar:** "Voice calls" link present in Convert group

## Decisions

- Consent and Schedule voice actions are inline on proposal follow-ups; proposal detail has full consent/opt-out flow
- Call log uses standard pagination (`items`, `pagination`)

## Next Steps

1. Restart dev server after schema changes (`rm -rf .next && npm run dev`) if 500 on proposal-followups
2. ~~Add production migration for Voice schema~~ — Done: `prisma/migrations/20260309_add_voice_schema/migration.sql` (VoiceCallOutcome enum, Proposal.contactPhone/voiceConsentAt/voiceOptedOutAt, VoiceCallLog table). Production deploy runs `prisma migrate deploy`.
3. Wire Retell/Vapi when API keys available
