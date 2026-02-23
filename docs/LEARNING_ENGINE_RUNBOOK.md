# Learning Engine — Runbook

## What it does

The Learning Engine ingests YouTube videos or channels, stores transcripts as artifacts, extracts summaries and principles, and generates **engine improvement proposals**. All changes are proposal-driven: the AI suggests; a human approves. Nothing is auto-applied to prompts, workflows, or production.

## Architecture

- **No new DB tables.** All learning data lives as **Artifacts** on a single system lead: `source: "system"`, `title: "Learning Engine Runs"`.
- Artifact types: `youtube_video`, `youtube_transcript`, `learning_summary`, `learning_principles`, `learning_actions`, `engine_improvement_proposal`, `learning_run_report`.
- Metadata (`artifact.meta`) includes: `sourceType`, `videoUrl`, `videoId`, `channelName`, `channelId`, `publishedAt`, `capturedAt`, `tags`, and for proposals the full structured object in `meta.proposal`.

## Env vars

| Variable | Purpose |
|----------|--------|
| `LEARNING_USE_MOCK_TRANSCRIPT` | Set to `1` to use stub transcript and channel discovery (no real YouTube API). Use for local/dev and UI testing. |
| (Future) YouTube/transcript provider keys | When a real transcript provider is wired, document the env vars here. |

No other env vars are required for MVP. The rest of the app (auth, DB, LLM) uses existing config.

## How to test video ingest

1. **With mock (no YouTube API)**  
   Set `LEARNING_USE_MOCK_TRANSCRIPT=1` in `.env`.

2. **Dashboard**  
   Go to **Learning** (`/dashboard/learning`), paste any YouTube video URL (e.g. `https://www.youtube.com/watch?v=...`), choose “Video”, click **Ingest**.

3. **API**  
   ```bash
   curl -X POST http://localhost:3000/api/learning/ingest \
     -H "Content-Type: application/json" \
     -H "Cookie: <your-session-cookie>" \
     -d '{"videoUrl":"https://www.youtube.com/watch?v=DUMMY"}'
   ```
   With mock, you get a run report with `ok: true`, artifacts created, and a generated proposal.

4. **Without mock**  
   If `LEARNING_USE_MOCK_TRANSCRIPT` is not set, transcript fetch uses a stub that returns **transcript unavailable** (or unsupported) until a real provider is plugged in. You’ll get a structured error in the response and in the run report.

## How channel ingest works

1. **Dashboard**  
   On Learning, paste a channel URL, choose “Channel”, (optionally set max videos), click **Ingest**.

2. **API**  
   ```bash
   curl -X POST http://localhost:3000/api/learning/ingest \
     -H "Content-Type: application/json" \
     -H "Cookie: <your-session-cookie>" \
     -d '{"channelUrl":"https://www.youtube.com/channel/...", "maxVideos": 10}'
   ```

3. **Flow**  
   - Resolve channel and discover recent videos (capped by `maxVideos`, default 10).
   - Dedupe by canonical `videoId`.
   - For each video, run the same pipeline as single-video ingest (transcript → summary → principles → actions → proposal).
   - One batch **learning_run_report** artifact: `discovered`, `ingested`, `skipped`, `errors`.

4. **With mock**  
   `LEARNING_USE_MOCK_TRANSCRIPT=1` uses a stub that returns a fake video list so you can test the full channel flow and “folder” grouping via `meta.channelId` / `channelName`.

## Known limitations

- **Transcript provider**  
  Real YouTube transcript fetching is not wired. Use `LEARNING_USE_MOCK_TRANSCRIPT=1` for development. Implement and plug a provider in `src/lib/learning/transcript.ts` (e.g. `TranscriptProvider`, `fetchTranscript`).

- **Channel discovery**  
  Real channel video listing is not wired. Same mock flag enables stub discovery. Implement in `src/lib/learning/transcript.ts` (`discoverChannelVideos`).

- **Rate limits**  
  No rate limiting in the Learning API yet. Add per-user or global limits when connecting real YouTube/transcript APIs.

- **Video metadata**  
  Optional fields (e.g. `publishedAt`, `channelName`) may be missing until a real metadata provider is integrated.

## How proposals are reviewed and applied

1. **Generated only**  
   Ingest creates `engine_improvement_proposal` artifacts with structured fields (title, sourceVideo, sourceChannel, insightType, problemObserved, principle, proposedChange, expectedImpact, effort, risk, metricToTrack, rollbackPlan, applyTarget) and human-readable markdown in `content`.

2. **Review**  
   Use **Learning** dashboard: “Proposed improvements” list and filters (channel / tag). Each card shows the full proposal structure.

3. **Apply**  
   **Manual only.** There is no “apply” button that changes prompts, workflows, or code. Operators copy or adapt suggestions into:
   - Prompt edits (e.g. in positioning or proposal prompts)
   - Workflow/playbook changes
   - UI or scorecard updates
   - New metrics or automation

4. **Command Center**  
   The “Learning Inbox” card shows count of improvement proposals and latest source; “Open Learning” goes to `/dashboard/learning`.

5. **Chatbot**  
   The operator chatbot gets the top 3 recent learning summaries and top 3 proposals as context. It can answer: what we learned from recent videos, what bottleneck fixes are suggested, what changes are proposed, and whether ideas are strategy vs implementation vs metrics.

## Testing

### Tier A — Automated (local)

- Set `LEARNING_USE_MOCK_TRANSCRIPT=1` for local testing.
- `learning-ingest.spec.ts` covers learning ingest flows.
- Test via API:
  ```bash
  curl -X POST http://localhost:3000/api/learning/ingest \
    -H "Content-Type: application/json" \
    -H "Cookie: <your-session-cookie>" \
    -d '{"videoUrl":"https://www.youtube.com/watch?v=DUMMY"}'
  ```

### Tier B — Manual production (MCP browser or real browser)

- Open `/dashboard/learning` — page loads, proposals list visible, promote/produced dropdowns work.
- Ingest a video URL — verify transcript, summary, principles, proposal appear.
- Check Command Center — Learning Inbox card shows proposal count.
- Chatbot: ask "What did we learn today?" — response references learning context.

See `docs/TESTING_SIDE_PANEL.md` for the full testing strategy and operator checklists.

## Quick reference

- **Learning dashboard:** `/dashboard/learning`
- **Ingest API:** `POST /api/learning/ingest` (body: `videoUrl?` | `channelUrl?`, `maxVideos?`, `tags?`)
- **List recent:** `GET /api/learning?limit=20`
- **Stub/mock:** `LEARNING_USE_MOCK_TRANSCRIPT=1`
