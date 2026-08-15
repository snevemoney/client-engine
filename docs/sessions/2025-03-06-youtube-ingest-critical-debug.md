# Session: YouTube Ingest Critical Debug & Consolidation

**Date:** 2025-03-06

## Goal

Implement the YouTube Ingest Critical Debug plan: unify failure handling so PROPOSAL_FAILED and FAILED_TRANSCRIPT both appear in the Failures tab with Retry, and fix the transcripts page empty expand.

## What Was Built

### 1. Unified Failures

- **`getUnifiedFailures()`** in `src/lib/youtube/queries.ts` — returns both FAILED_TRANSCRIPT (from YouTubeTranscript) and PROPOSAL_FAILED (from YouTubeIngestJob) in a single list, sorted by date
- **`GET /api/youtube/failures`** — new route returning unified failures
- **Failures tab** — now consumes unified failures, shows type badge (Transcript failed / Proposal failed), error text, and Retry for both types

### 2. Data Flow Changes

- **Page** — fetches `getUnifiedFailures(30)` instead of `getFailedTranscripts(20)`, passes `initialFailures` to client
- **Client** — `initialFailures` prop, `failures` state, `refreshData()` fetches `/api/youtube/failures`
- **Jobs** — added `normalizedUrl` to source select for future use (Retry lives in Failures, not Jobs)

### 3. Transcripts Page

- **`getTranscripts({ includeText: true })`** — optionally includes `transcriptText`
- **API** — `?includeText=1` support in `/api/youtube/transcripts`
- **Transcripts page** — fetches with `includeText=1&limit=100`, uses transcriptText for expand and search; fallback "(No transcript text)" when empty

### 4. Retry Result Styling

- `handleRetry` now treats PROPOSAL_FAILED and FAILED_TRANSCRIPT as failures (amber) even when `data.ok` is true

## Decisions

- Retry lives only in Failures tab; Jobs tab remains audit log
- Unified failure shape: `{ id, videoId, sourceUrl, error, type, providerUsed, title, createdAt }`
- Transcripts page requests full text (includeText=1) for search and expand; no lazy load

## Files Modified

- `src/lib/youtube/queries.ts` — getUnifiedFailures, getTranscripts includeText, job source normalizedUrl
- `src/app/api/youtube/failures/route.ts` — new
- `src/app/api/youtube/transcripts/route.ts` — includeText param
- `src/app/dashboard/youtube/page.tsx` — getUnifiedFailures, initialFailures
- `src/components/dashboard/youtube/YouTubeIngestClient.tsx` — initialFailures, failures state, Failures tab UI, refreshData, handleRetry result styling
- `src/app/dashboard/youtube/transcripts/page.tsx` — includeText=1 fetch, transcriptText guards
