# YouTube Ingest Pipeline — Runbook

> Private operator intelligence pipeline for YouTube transcript ingestion, classification, and human-gated learning.

---

## Provider Order

Transcripts are resolved through a provider chain. Each provider is tried in order; the first to succeed wins.

| Priority | Provider | Requires | Notes |
|----------|----------|----------|-------|
| 1 | `transcript-api` | `youtube-transcript` + `@danielxceron/youtube-transcript` npm packages (installed) | Two npm variants tried in sequence |
| 2 | `youtube-captions` | Nothing (scrapes public YouTube page) | Parses captionTracks from watch page HTML → fetches timedtext XML |
| 3 | `yt-dlp` | `yt-dlp` binary + `YOUTUBE_YTDLP_ENABLED=1` env var | Subtitle extraction to VTT, parsed locally |
| 4 | `whisper` | `yt-dlp` binary + `OPENAI_API_KEY` + `YOUTUBE_WHISPER_ENABLED=1` | Audio download → OpenAI Whisper API. Expensive but highest coverage |

### Feature flags

```env
# Enable yt-dlp provider (requires yt-dlp binary in PATH)
YOUTUBE_YTDLP_ENABLED=1

# Enable Whisper provider (requires yt-dlp + OPENAI_API_KEY)
YOUTUBE_WHISPER_ENABLED=1
```

---

## Retry Policy

- Each provider is retried up to **2 times** (configurable via `maxRetries` in `transcriptResolver.ts`)
- Backoff: exponential starting at 1.5s (1.5s, 3s)
- **Non-transient errors skip retries**: `TRANSCRIPT_UNAVAILABLE`, `NOT_CONFIGURED`
- **Transient errors retry**: `NETWORK_ERROR`, `RATE_LIMITED`, `PROVIDER_BLOCKED`
- After all providers fail: job marked `FAILED_TRANSCRIPT` with aggregated error details

---

## What "Guarantee" Means in Practice

There is no 100% transcript guarantee. The system maximizes reliability through:

1. **Multi-provider chain** — 4 independent methods, each with different failure modes
2. **Structured failure tracking** — every failure is logged with provider, error code, and attempt count
3. **Retry with backoff** — transient failures get automatic retries
4. **Manual fail visibility** — all failures surface in the Failures & Interventions panel with retry buttons
5. **De-duplication** — already-ingested videos are skipped, not re-processed

When all providers fail, the operator sees exactly what happened and can:
- Retry later (network/rate-limit issues often resolve)
- Check if the video has captions at all
- Manually note why a video can't be transcribed

---

## Status Lifecycle

```
PENDING → FETCHING → TRANSCRIBED → READY_FOR_REVIEW
                   ↘ FAILED_TRANSCRIPT (retry available)
                   
READY_FOR_REVIEW → PROMOTED_TO_PLAYBOOK (human approval)
                 → REJECTED (human decision)
                 → KNOWLEDGE_ONLY (useful but no action needed)
```

---

## Human-Gated Promotion Policy

**Critical guardrails — these are not suggestions, they are hard constraints:**

- **No transcript auto-applies to prompts, SOPs, or playbooks**
- **No automatic prompt overwrites from learning**
- **No automatic SOP replacements**
- **All learning proposals start as `READY_FOR_REVIEW`**
- **Promotion to playbook requires explicit human action via the UI or API**
- **Every proposal shows what it would change and why, before any action**

The system proposes; the operator decides. This is by design.

---

## Common Failure Causes and Interventions

| Failure | Cause | Intervention |
|---------|-------|--------------|
| `TRANSCRIPT_UNAVAILABLE` from all providers | Video has no captions, or is age-restricted/private | Check video manually. If no captions exist, mark as knowledge gap or skip. |
| `PROVIDER_BLOCKED` | YouTube rate-limiting or IP block | Wait and retry. Consider spacing out channel ingests. |
| `NETWORK_ERROR` | DNS/connectivity issue | Check server connectivity. Retry. |
| `RATE_LIMITED` | Too many requests in short period | Automatic backoff handles this. If persistent, reduce channel ingest concurrency. |
| `PARSING_FAILED` | YouTube changed page structure | Check for package updates. The caption XML parser may need adjustment. |
| Whisper: "Audio file too large" | Video > 25MB as audio | Not all videos are Whisper-eligible. Other providers handle this. |

---

## Data Model

### `YouTubeSource`
One record per unique video or channel submitted. De-duped by `externalId` (videoId or channelId).

### `YouTubeIngestJob`
One record per ingest attempt. Tracks status, attempts, provider used, errors, timing.

### `YouTubeTranscript`
One record per video transcript. De-duped by `videoId` (unique). Stores full text, segments JSON, language, duration, provider, hash.

### `LearningProposal`
One record per learning proposal derived from a transcript. Links to transcript. Stores summary, classification, system area, proposed actions, revenue link, reviewer notes.

---

## API Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/youtube/ingest/video` | Ingest single video `{ url }` |
| POST | `/api/youtube/ingest/channel` | Ingest channel `{ url, limit? }` |
| GET | `/api/youtube/jobs` | List jobs `?limit=&status=` |
| GET | `/api/youtube/transcripts` | List transcripts `?limit=&status=&channelId=&provider=` |
| GET | `/api/youtube/learning` | List proposals `?limit=&status=&category=&systemArea=` |
| POST | `/api/youtube/learning/:id/promote` | Promote proposal `{ reviewerNotes? }` |
| POST | `/api/youtube/learning/:id/reject` | Reject proposal `{ reviewerNotes?, knowledgeOnly? }` |

---

## Channel Ingest Specifics

- Default limit: 10 videos per channel run
- Max limit: 50 videos per channel run
- Concurrency: 3 parallel video ingests (configurable in `channelIngest.ts`)
- De-duplication: videos already in `YouTubeTranscript` with `TRANSCRIBED` status are skipped
- Run summary tracks: total found, already ingested, transcribed, failed, queued for review

---

## Business Lens

Every transcript feeds the operator intelligence pipeline:

- **Acquire**: positioning notes, sales scripts, objection handling, follow-up scripts
- **Deliver**: delivery checklists, client workflows, SOPs
- **Improve**: reusable components, process refinement, case study angles

If a transcript doesn't map to a likely benefit, the system classifies it as `knowledge_only` — no junk drawer, but nothing forced either.

---

## Test Checklist

### Tier A — Automated / local

- [ ] Single video URL ingests successfully (transcript + proposal created)
- [ ] Channel URL discovers videos and batch-ingests
- [ ] De-dupe works (same video URL submitted twice → second is skipped)
- [ ] Fallback provider used when primary fails
- [ ] Failed transcript status is set correctly
- [ ] Retry works for failed transcripts
- [ ] Manual promote creates `PROMOTED_TO_PLAYBOOK` status
- [ ] Manual reject creates `REJECTED` or `KNOWLEDGE_ONLY` status

### Tier B — Manual production (MCP browser or real browser)

- [ ] Failed transcript is visible in Failures & Interventions panel on Command Center
- [ ] Retry button works for failed transcripts in production
- [ ] Command Center summary card shows correct counts (transcripts, proposals)
- [ ] Learning proposals show classification, system area, and revenue link
- [ ] Promoted proposals reflect in learning dashboard and chatbot context

See `docs/TESTING_SIDE_PANEL.md` for the full testing strategy and operator checklists.
