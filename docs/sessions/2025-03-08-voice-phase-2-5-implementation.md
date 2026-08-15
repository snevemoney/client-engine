# Session: Voice Assistant Phase 2–5 Implementation — 2025-03-08

## Goal

Implement Voice Assistant Phases 2–5 for Client Engine per the user's specification: API routes, proposal followups extension, processVoiceFollowUps cron, metrics, and VoiceFollowupsCard on Command Center.

## Decisions Made

- **Webhook body parsing** — Support both camelCase and snake_case (proposalId/proposal_id, externalCallId/external_call_id, durationSeconds/duration_seconds) for Retell/Vapi compatibility.
- **Rate limit tracking** — Use ProposalActivity with type `followup_scheduled` and `metaJson.source === "voice"` to count daily schedule attempts; no new schema.
- **Calling window** — 9–18 local (server timezone); no operator timezone config for Phase 4 stub.
- **Degraded mode** — `degraded: true` when neither VAPI_API_KEY nor RETELL_API_KEY is set; VoiceFollowupsCard shows DegradedBanner.

## What Was Built

### Phase 2 — API routes
- `src/app/api/voice/eligible/route.ts` — GET, returns getEligibleProposals()
- `src/app/api/voice/schedule-follow-up/route.ts` — POST, validates consent, stubs (logs intent via ProposalActivity)
- `src/app/api/voice/webhook/route.ts` — POST, idempotent by externalCallId, calls logCallOutcome; recordOptOut when outcome=opted_out
- `src/app/api/voice/consent/route.ts` — POST, sets voiceConsentAt
- `src/app/api/voice/opt-out/route.ts` — POST, calls recordOptOut
- `.env.example` — VAPI_API_KEY, RETELL_API_KEY (optional)

### Phase 3 — Proposal followups extension
- `src/app/api/proposals/followups/route.ts` — bucket=voice_eligible, voiceEligible array and totals.voiceEligible
- `src/app/api/proposals/followup-summary/route.ts` — voiceEligible count
- `src/app/dashboard/proposal-followups/page.tsx` — voice_eligible bucket, summary tile, button labels

### Phase 4 — processVoiceFollowUps
- `src/lib/voice/process.ts` — processVoiceFollowUps() with calling window 9–18, rate limit 10/day, stub schedule
- `src/app/api/voice/process/route.ts` — POST, cron auth Bearer AGENT_CRON_SECRET

### Phase 5 — Metrics + Command Center
- `src/app/api/voice/metrics/route.ts` — GET, eligibleCount, totalCalls, successRate, degraded?
- `src/components/dashboard/command/VoiceFollowupsCard.tsx` — fetches metrics, shows DegradedBanner when stub
- `src/app/dashboard/command/CommandSection2.tsx` — VoiceFollowupsCard added

## Key Insights

- ProposalActivity `followup_scheduled` with metaJson.source="voice" provides rate-limit tracking without schema changes.
- Webhook idempotency is handled by logCallOutcome (existing) using externalCallId.
- Proposal followups page already uses URL param `bucket`; adding voice_eligible required ApiResponse type and getBucketItems updates.

## Trade-offs Accepted

- Server local time for calling window (no operator timezone); acceptable for single-tenant Phase 4.
- Stub-only schedule: no actual Retell/Vapi outbound until API keys are set.

## Next Steps

- [ ] Add Retell or Vapi outbound call when API key present (Phase 2.3)
- [ ] Contract tests for /api/voice/* per API_CONTRACTS.md
- [ ] Cron job schedule for POST /api/voice/process (e.g. 2x/day within 9–18 window)
