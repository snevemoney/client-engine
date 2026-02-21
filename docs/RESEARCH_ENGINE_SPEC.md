# Research Engine → Proposals (Phase R1)

**Goal:** AI research online turns into draft proposals with zero input from you.  
**Direction:** Client acquisition (automation / AI ops / integrations buyers).  
**Constraint:** Drafting is automated; send/build stay gated (existing approval + build gates).

---

## 1. Tables / artifacts to add

### 1.1 Use existing Lead + Artifact (no new tables for R1)

- **Lead**
  - `source`: set to `"research"` (or `"research:jobboard"`, `"research:rfp"` later).
  - `sourceUrl`: canonical opportunity URL (for dedupe + provenance).
  - `title`, `description` from extracted content; other fields from Enrich step as today.

- **Artifact (new type)**
  - `type`: `"research"` (or `"source"`).
  - `title`: `"RESEARCH_SNAPSHOT"`.
  - `content`: plain text extract of the opportunity (company, role, constraints, budget clues, urgency, raw snippet).
  - `meta`: `{ sourceUrl, capturedAt (ISO), sourceType?, skipReason? }` for provenance.

- **Dedupe (R1 minimal)**  
  Use existing `Lead.contentHash` or add a **research fingerprint**:
  - Before creating a lead: fingerprint = `hash(normalize(title) + domain(sourceUrl))`.
  - Query: `Lead.findFirst({ where: { sourceUrl } })` or by contentHash if you store fingerprint in a field.
  - Optional later: table `ResearchSeen { urlHash, seenAt, skipReason }` for high volume.

### 1.2 Optional table (Phase R2)

- **ResearchSource** (later): id, name, type (job_feed | rfp | company_signal), config (JSON), isActive, lastRunAt.

---

## 2. Cron / worker job names and flow

**Single cron job (R1):** `research-discover-and-pipeline`

- **Schedule:** every 30–60 min (e.g. `*/45 * * * *`).
- **Command:** `node scripts/research-discover-and-pipeline.js` (or `pnpm run research:run`).
- **Flow:**
  1. **Discover** → fetch from 1–2 sources (see §3), output list of RawOpportunity.
  2. **Extract** → for each URL, fetch + extract (title, company, snippet, contact path, budget clues); output OpportunityDoc.
  3. **Dedupe + filter** → skip if already have lead with same sourceUrl or fingerprint; skip if low-signal (see §4).
  4. **Lead factory** → create Lead (source, sourceUrl, title, description from extract); create artifact type `"research"`, title `"RESEARCH_SNAPSHOT"` with content + meta.
  5. **Trigger pipeline** → `runPipelineIfEligible(leadId, "research_ingested")`.

**Env:** `OPENAI_API_KEY` (for extract step if you use LLM), optional `RESEARCH_CRON_ENABLED=1`. No Redis required for R1 (in-process or cron-only).

---

## 3. First 20 search queries (“signals”) — client acquisition

Use these as job-board keywords or search patterns (exact syntax depends on source: Upwork, LinkedIn, Indeed, or a scraper).

| # | Query / signal |
|---|-----------------|
| 1 | automation consultant |
| 2 | n8n integration |
| 3 | Zapier alternative |
| 4 | workflow automation developer |
| 5 | AI ops engineer |
| 6 | process automation freelancer |
| 7 | integrate API with our app |
| 8 | build internal tool automation |
| 9 | no-code automation custom |
| 10 | RevOps automation |
| 11 | CRM automation developer |
| 12 | AI workflow automation |
| 13 | automation + Node.js |
| 14 | automation + React |
| 15 | “workflow” “automation” “freelance” |
| 16 | Make.com integration |
| 17 | Pipedrive Zapier |
| 18 | custom integration developer |
| 19 | automation agency |
| 20 | business process automation |

**R1 scope:** Pick 1–2 sources (e.g. one job board API or one “company hiring” feed) and 5–10 of these queries to avoid rate limits and stay within cost caps.

---

## 4. Dedupe rules

- **Same URL:** if `Lead` with same `sourceUrl` exists → skip (idempotent).
- **Fingerprint:** optional hash of `domain + normalizedTitle`; if exists → skip.
- **Low-signal discard (with optional skip reason in log):**
  - “intern”, “unpaid”, “volunteer”, “equity only” → skip.
  - No contact path (no email, no form, no “apply” link) → skip.
  - Generic spam keywords in title/body → skip.
- **Rate limit per domain:** e.g. max 2 new leads per domain per day (config later).

---

## 5. Lead-to-proposal prompt additions (“why them / why now” from research)

Proposals must be able to cite the research snapshot so “Why now” and “Opening” feel specific.

### 5.1 Artifact contract

- When a lead has an artifact `type === "research"` and `title === "RESEARCH_SNAPSHOT"`, the proposal step must receive its `content` (and optionally `meta.sourceUrl`, `meta.capturedAt`).

### 5.2 Prompt changes

**File:** `src/lib/pipeline/prompts/buildProposalPrompt.ts`

- Extend `LeadForProposal` (or add an optional argument):
  - `researchSnapshot?: string | null` — raw text of RESEARCH_SNAPSHOT.
  - `researchSourceUrl?: string | null` — for “we saw your [role/post] at [url]”.
- In the prompt template, add a conditional block **after** “Lead info” and **before** “Generate a proposal”:

```text
---

## Research snapshot (use for “Why them” and “Why now”)

${researchSnapshot ?? "Not available — use lead description only."}

${researchSourceUrl ? `(Source: ${researchSourceUrl})` : ""}

---
```

- **Instructions to add in the prompt:**  
  “If a research snapshot is provided, use it to make ‘Why now’ and ‘Opening’ specific (e.g. recent post, hiring signal, tech stack, or pain described in the source). Do not invent facts; cite the snapshot or the lead description.”

### 5.3 Proposal step wiring

**File:** `src/lib/pipeline/propose.ts` (or wherever `buildProposalPrompt` is called)

- After loading the positioning artifact, check for research artifact:
  - `db.artifact.findFirst({ where: { leadId, type: "research", title: "RESEARCH_SNAPSHOT" } })`.
- If found, pass `researchSnapshot: artifact.content`, `researchSourceUrl: (artifact.meta as any)?.sourceUrl ?? null` into `buildProposalPrompt`.
- If not found, pass `researchSnapshot: null`, `researchSourceUrl: null` (current behavior).

---

## 6. Notifications (R1 minimal)

- **On pipeline run completion (research-sourced lead):** optional webhook/Discord: “Research: X new proposals ready to review” (count of leads created this run with status that reached proposal).
- **On failure:** use existing pipeline failure handling; add optional “research run failed” alert when the cron job exits non-zero or throws.

---

## 7. Guardrails (reminder)

- Rate limit: existing rate limits on pipeline/propose apply; add per-domain or per-cron limits if you do heavy fetch.
- Cost caps: max pages/day, max leads/day, max LLM tokens/day (config/env) when you add more sources.
- Provenance: every research-sourced lead has RESEARCH_SNAPSHOT artifact with sourceUrl + capturedAt in meta.

---

## 8. Pass criteria for Phase R1

- [x] Cron (or one-off script) runs: discover → dedupe → create lead + RESEARCH_SNAPSHOT → runPipelineIfEligible.
- [x] Lead created from research has `source`/`sourceUrl` and one artifact type `research`, title `RESEARCH_SNAPSHOT`.
- [x] Proposal step uses research snapshot in prompt when present; “Why now” / “Opening” can reference it.
- [x] No new tables required for R1 (optional ResearchSeen in R2).
- [ ] One manual test: run job once → lead appears → pipeline runs → proposal draft includes research-based phrasing.

---

## 9. Implementation (R1)

### How it works

1. **Entrypoint:** `runResearchDiscoverAndPipeline({ limit?: number })` in `src/lib/research/run.ts`.
2. **Adapters:** Source adapter interface in `src/lib/research/types.ts`. R1 ships one adapter: **RSS/Atom** (`src/lib/research/adapters/rss.ts`), which fetches `RESEARCH_FEED_URL`. No scraping; feeds are public and ToS-safe.
3. **Dedupe:** `sourceUrl` is canonicalized (strip UTM/ref/hash). If a `Lead` with that `sourceUrl` exists, skip.
4. **Filter:** Low-signal keywords (intern, unpaid, volunteer, equity only, etc.) skip before create (`src/lib/research/filter.ts`).
5. **Lead + artifact:** Create `Lead` with `source: "research"`, `sourceUrl`, `title`, `description`, `tags`. Create `Artifact` with `type: "research"`, `title: "RESEARCH_SNAPSHOT"`, `content` (cleaned text), `meta: { sourceUrl, capturedAt, adapter, confidence }`.
6. **Pipeline:** For each new lead, call `runPipelineIfEligible(leadId, "research_ingested")` (fire-and-forget).
7. **Report:** Each run writes an artifact `type: "research"`, `title: "RESEARCH_RUN_REPORT"` to a system lead (“Research Engine Runs”) with counts: discovered, filtered, skippedDedupe, created, errors.

### Env vars

| Var | Required | Description |
|-----|----------|-------------|
| `RESEARCH_ENABLED` | Yes (to run) | Set to `1` or `true` to enable ingest. |
| `RESEARCH_FEED_URL` | For RSS | RSS/Atom feed URL (e.g. job board feed). |
| `RESEARCH_LIMIT_PER_RUN` | No | Max leads to create per run (default 10, max 50). |
| `RESEARCH_CRON_SECRET` | No | If set, `POST /api/research/run` accepts `Authorization: Bearer <secret>` for cron. |
| `DATABASE_URL` | Yes | For Lead/Artifact and pipeline. |

### Safety notes

- No auto-send; no auto-build. Existing gates unchanged.
- Only ingest sources you are allowed to fetch (RSS/APIs). No heavy scraping.
- Rate: one run per cron interval (e.g. every 45 min); `RESEARCH_LIMIT_PER_RUN` caps new leads per run.
- Errors are logged and included in `RESEARCH_RUN_REPORT` with `formatStepFailureNotes` (code-prefixed).
- Dry-run: if `PIPELINE_DRY_RUN=1`, pipeline steps still create placeholder artifacts; research job still creates leads + RESEARCH_SNAPSHOT.

### How to test locally

1. Set env (e.g. in `.env`):
   - `RESEARCH_ENABLED=1`
   - `RESEARCH_FEED_URL=<RSS or Atom feed URL>` (e.g. a job board feed; if unset, discover returns 0 items).
   - `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` (and `OPENAI_API_KEY` unless using dry-run).
2. **Option A — API:** Start app (`npm run dev`), then:
   - Log in and `POST http://localhost:3000/api/research/run` (session cookie), or
   - `curl -X POST http://localhost:3000/api/research/run -H "Authorization: Bearer YOUR_RESEARCH_CRON_SECRET"`.
   - Response: `{ ok, at, discovered, filtered, skippedDedupe, created, errors, leadIds? }`.
3. **Option B — CLI:** `npm run research:run`. Prints same report as JSON; exit 0 if ok, 1 if errors.
4. **Expected:** If feed has new items: `created` > 0, new leads with `source: "research"` and RESEARCH_SNAPSHOT artifact; pipeline runs for each (check `/dashboard/metrics`). If feed empty or all deduped: `created: 0`. RESEARCH_RUN_REPORT artifacts appear on the system lead “Research Engine Runs”.

### How to run on VPS

1. **Env:** Set `RESEARCH_ENABLED=1`, `RESEARCH_FEED_URL`, `RESEARCH_LIMIT_PER_RUN` (optional), `RESEARCH_CRON_SECRET` (optional, for cron auth). Same DB and auth vars as app.
2. **Cron (recommended):** Run every 45 minutes:
   ```bash
   */45 * * * * cd /path/to/client-engine-1 && /usr/bin/npm run research:run >> /var/log/client-engine-research.log 2>&1
   ```
   Or call the API from cron (app must be up):
   ```bash
   */45 * * * * curl -s -X POST https://evenslouis.ca/api/research/run -H "Authorization: Bearer $RESEARCH_CRON_SECRET" >> /var/log/client-engine-research.log 2>&1
   ```
3. **Service:** No separate worker process required; cron or HTTP trigger is enough for R1.

### Optional: Learning insights as enrichment context

Learning Engine (YouTube transcript ingestion) and Knowledge Engine produce **learning insights** and **improvement suggestions**. These can be used as optional context for the operator brief and ops chatbot (e.g. “what we learned from recent videos”, “what to improve next”). See `docs/LEARNING_ENGINE_RUNBOOK.md` and `docs/KNOWLEDGE_ENGINE_RUNBOOK.md`. No change to research flow; learning is a separate ingestion path.
