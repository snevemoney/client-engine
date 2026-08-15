# Session: YouTube PROPOSAL_FAILED Error Persistence

**Date:** 2025-03-04

## Goal

Persist the learning proposal error when YouTube ingest fails at the proposal step, so the Jobs table Error column shows the real failure instead of empty.

## What Was Built

- In `src/lib/youtube/videoIngest.ts`:
  - Capture `proposalError` in the catch block when `generateLearningProposal` throws
  - Set `lastError` on the job when `proposalFailed` (so UI shows it)
  - Add `proposalError` to `runSummaryJson` for debugging

## Decisions

- Reuse existing `lastError` field on `YouTubeIngestJob` (same as transcript failures)
- Include `proposalError` in `runSummaryJson` for API consumers and future debugging

## Follow-up: Proposal Retry When Transcript Exists

- De-dupe now checks for LearningProposal: only return ALREADY_INGESTED when transcript has a proposal
- If transcript exists but no proposal (e.g. after PROPOSAL_FAILED), `runProposalRetry` runs: creates job, generates proposal from existing transcript, updates job
- Re-paste URL or Retry on a PROPOSAL_FAILED video now retries proposal generation instead of returning ALREADY_INGESTED

## Next Steps

- Re-run ingest on a video that previously showed PROPOSAL_FAILED to confirm the Error column now populates and Retry works
