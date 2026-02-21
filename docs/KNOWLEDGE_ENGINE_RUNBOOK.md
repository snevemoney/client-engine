# Knowledge Engine — Runbook

## What it does

The Knowledge Engine ingests YouTube videos or channels, stores transcripts and summaries as artifacts, extracts **knowledge insights** (principles, tactics, warnings, metrics/bottleneck/website/proposal ideas), and generates **improvement suggestions** for the Client Engine. All suggestions are queued for human review; nothing is auto-applied. Optional **workday queue**: add URLs to a pending queue and the next workday run will ingest them (capped).

## Architecture

- **No new DB tables.** All knowledge data lives as **Artifacts** on a single system lead: `source: "system"`, `title: "Knowledge Engine Runs"`.
- **Artifact types:** `YOUTUBE_VIDEO_TRANSCRIPT`, `YOUTUBE_VIDEO_SUMMARY`, `YOUTUBE_CHANNEL_INDEX`, `KNOWLEDGE_INSIGHT`, `IMPROVEMENT_SUGGESTION`, `KNOWLEDGE_RUN_REPORT`, `PENDING_KNOWLEDGE_URL`.
- **Metadata** (artifact.meta): `sourceUrl`, `channelName`, `videoTitle`, `publishedAt`, `capturedAt`, `tags`, `confidence`; for suggestions also `problem`, `proposedChange`, `expectedImpact`, `effort` (S/M/L), `systemArea`, `sourceTranscriptRef`, `status` (queued/reviewed/applied/dismissed).

## Env vars

| Variable | Purpose |
|----------|--------|
| `LEARNING_USE_MOCK_TRANSCRIPT` | Set to `1` to use stub transcript and channel discovery (shared with Learning engine). Use for local/dev. |

No other env vars are required for the Knowledge engine. LLM and DB use existing app config.

## Daily usage flow

### Before work (autopilot)

1. **Optional:** In **Knowledge** (`/dashboard/knowledge`), add video or channel URLs to the **workday queue** (e.g. "Add to queue"). These will be ingested during the next workday run (capped at 3 per run).
2. Run **Command Center** → **Start Workday Automation** (or cron `POST /api/ops/workday-run`).
   - Research → pipeline for eligible leads → retries → **knowledge queue**: up to 3 pending URLs are ingested (video or channel).
   - **WORKDAY_RUN_REPORT** includes a **Knowledge queue** line: processed count, ingested count, errors.
3. No further action required. No auto-send, no auto-build.

### After work (10x productivity)

1. Open **Command Center**.
2. **Knowledge Queue** card: see transcripts/insights/suggestions counts for today and queued total. **Top Suggested Improvements** card: recent suggestions by system area.
3. Click **Brief Me** → briefing now includes **Knowledge-derived improvement suggestions** (top 5). Review in **Knowledge** dashboard.
4. **Chatbot**: ask "What did we learn today?", "What should we improve next?", "Which bottleneck fixes came from transcript learning?", "What website/project monetization changes should we make?" Context includes recent knowledge summaries and suggestions.
5. **Knowledge** page: review improvement suggestions (queued), filter by area. Apply manually (no auto-apply).
6. **Settings** → **Website / Project monetization**: see which projects are mapped to trust, lead_capture, conversion, delivery, proof, upsell. Edit and save.

## API

- `POST /api/knowledge/ingest` — Body: `videoUrl?` \| `channelUrl?`, `maxVideos?`, `tags?`. Ingest video or channel.
- `GET /api/knowledge?limit=20` — Recent runs, transcripts, summaries, insights, suggestions.
- `GET /api/knowledge/queue` — List pending URLs for workday run.
- `POST /api/knowledge/queue` — Body: `url`, `type` ("video" \| "channel"), `maxVideos?`. Add to queue.

## Command Center integration

- **Knowledge Queue** card: transcripts today, insights today, suggestions today, queued for review. Link to **Knowledge**.
- **Top Suggested Improvements** card: top 5 suggestions; link to **Knowledge**.
- **Brief Me**: output includes a "Knowledge-derived improvement suggestions" section (top 5).
- **Chat**: system prompt includes recent knowledge summaries and suggestions (top 3 each).

## Website/Project monetization (Phase 5)

- **Settings** → **Website / Project monetization**: table of projects (from DB) with checkboxes for roles: trust, lead_capture, conversion, delivery, proof, upsell.
- Stored in a single artifact on system lead (`project_monetization` / `MONETIZATION_MAP`). No new tables.
- **API:** `GET /api/ops/monetization` — current map; `PATCH /api/ops/monetization` — body `{ projectRoles: { [slug]: string[] } }`.

## Autopilot (Phase 6)

- Pending URLs are stored as `PENDING_KNOWLEDGE_URL` artifacts (content = URL, meta = type, maxVideos).
- Workday run calls `processPendingKnowledgeQueue(3)` after pipeline: up to 3 pending URLs are ingested (video or channel), then removed from queue.
- Results appear in **WORKDAY_RUN_REPORT** and in **OPERATOR_BRIEFING** (via existing knowledge-derived suggestions section).

## Safety

- No auto-send, no auto-build. Improvement suggestions are queued only; human approves any change.
- Knowledge ingestion does not modify leads, proposals, or production code.

## Limitations

- **Transcript/channel provider:** Same as Learning engine. Set `LEARNING_USE_MOCK_TRANSCRIPT=1` for dev; wire real provider in `src/lib/learning/transcript.ts`.
- **Suggestion status:** Queued by default; "reviewed" / "applied" / "dismissed" are stored in meta but no UI to change status yet (TODO: status toggle on Knowledge page).

---

## Deliverables summary

### File-by-file

| Area | Files |
|------|--------|
| **Knowledge module** | `src/lib/knowledge/types.ts`, `insights.ts`, `suggestions.ts`, `ingest.ts`, `index.ts` |
| **API** | `src/app/api/knowledge/route.ts` (GET), `src/app/api/knowledge/ingest/route.ts` (POST), `src/app/api/knowledge/queue/route.ts` (GET/POST), `src/app/api/ops/monetization/route.ts` (GET/PATCH) |
| **Dashboard** | `src/app/dashboard/knowledge/page.tsx`, `src/components/dashboard/knowledge/KnowledgePageClient.tsx` |
| **Command Center** | `src/components/dashboard/command/KnowledgeQueueCard.tsx`, `TopSuggestionsCard.tsx`; `src/app/dashboard/command/page.tsx` (fetches + cards) |
| **Sidebar** | `src/components/dashboard/sidebar.tsx` (Knowledge nav item) |
| **Brief + Chat** | `src/lib/ops/operatorBrief.ts` (knowledge suggestions in brief), `src/app/api/ops/chat/route.ts` (knowledge context) |
| **Monetization** | `src/lib/ops/monetization.ts`, `src/components/dashboard/settings/MonetizationMapSection.tsx`; Settings page section |
| **Workday autopilot** | `src/lib/ops/workdayRun.ts` (processPendingKnowledgeQueue), `src/lib/ops/types.ts` (knowledge in summary) |
| **Docs** | `docs/KNOWLEDGE_ENGINE_RUNBOOK.md` |

### Daily usage flow

- **Before work:** (Optional) Add video/channel URLs to queue in Knowledge. Run workday automation; knowledge queue is processed (cap 3). Report includes knowledge section.
- **After work:** Command Center → Knowledge Queue + Top Suggestions cards. Brief Me includes knowledge-derived suggestions. Chatbot answers what we learned / what to improve / bottleneck fixes / website monetization. Knowledge page: review suggestions. Settings: project monetization mapping.

### Env vars

- `LEARNING_USE_MOCK_TRANSCRIPT=1` — Use stub transcript/channel for dev (shared with Learning engine). No other new env vars.

### Fully working vs TODO

| Feature | Status |
|--------|--------|
| Video ingest (single URL) | Working (with mock or real provider) |
| Channel ingest (N videos, channel index artifact) | Working (with mock or real provider) |
| Transcript → summary + insights + suggestions | Working |
| Knowledge Queue + Top Suggestions cards | Working |
| Brief Me includes knowledge suggestions | Working |
| Chatbot knowledge context | Working |
| Project monetization map (Settings) | Working |
| Pending queue + workday run ingestion | Working |
| Real YouTube transcript API | TODO: wire in `src/lib/learning/transcript.ts` |
| Real channel discovery API | TODO: same file |
| Suggestion status toggle (queued → reviewed/applied/dismissed) | TODO: UI on Knowledge page |
