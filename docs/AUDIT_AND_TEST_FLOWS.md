# Full Audit & Test Flows

**Purpose:** Single reference for every page, API, and user flow. Use for full regression and "no corners missed" testing.

**Testing tiers:** (A) Automated Playwright tests for repeatability, (B) Manual production checks (MCP browser or real browser) for real-world behavior. See `docs/TESTING_SIDE_PANEL.md` for the full testing strategy, operator checklists, and troubleshooting.

---

## 1. App routes (pages)

| Route | Description | Protected |
|-------|-------------|-----------|
| `/` | Home/landing | No |
| `/login` | Sign in | No (redirects to /dashboard if logged in) |
| `/dashboard` | Dashboard home (command) | Yes |
| `/dashboard/leads` | Leads list | Yes |
| `/dashboard/leads/new` | New lead form | Yes |
| `/dashboard/leads/[id]` | Lead detail (artifacts, Copilot, pipeline actions, sales process) | Yes |
| `/dashboard/proposals` | Proposals list + follow-up queue | Yes |
| `/dashboard/proposals/[id]` | Proposal console (edit sections, toggles) | Yes |
| `/dashboard/metrics` | Pipeline metrics | Yes |
| `/dashboard/command` | Command center / brief | Yes |
| `/dashboard/chat` | Ops chat | Yes |
| `/dashboard/knowledge` | Knowledge engine | Yes |
| `/dashboard/learning` | Learning engine | Yes |
| `/dashboard/proof` | Proof / portfolio | Yes |
| `/dashboard/checklist` | Checklist | Yes |
| `/dashboard/conversion` | Conversion metrics | Yes |
| `/dashboard/deploys` | Deploys | Yes |
| `/dashboard/settings` | Settings | Yes |
| `/dashboard/ops-health` | Ops health panel | Yes |
| `/dashboard/sales-leak` | Sales leak dashboard | Yes |
| `/dashboard/results` | Results ledger | Yes |
| `/dashboard/youtube` | YouTube ingest pipeline | Yes |
| `/dashboard/build-ops` | Build ops / agent tasks | Yes |
| `/work` | Work (public?) | Depends on app |
| `/work/[slug]` | Work item by slug | Depends on app |
| `/demos/[slug]` | Demo pages | Depends on app |

---

## 2. API routes (by method)

### Public / no auth
- `GET /api/health` — Health check (ok, checks)

### Auth required (return 401 without session)

**Leads**
- `GET /api/leads` — List leads
- `POST /api/leads` — Create lead
- `GET /api/leads/[id]` — Get lead
- `PATCH /api/leads/[id]` — Update lead (restricted fields)
- `DELETE /api/leads/[id]` — Delete lead
- `GET /api/leads/[id]/artifacts` — List artifacts
- `POST /api/leads/[id]/artifacts` — Create artifact
- `GET /api/leads/[id]/opportunity-brief` — Opportunity brief
- `GET /api/leads/[id]/roi` — ROI estimate
- `POST /api/leads/[id]/roi` — Set ROI
- `GET /api/leads/[id]/client-success` — Client success data
- `POST /api/leads/[id]/client-success` — Update client success
- `POST /api/leads/[id]/approve` — Approve lead
- `POST /api/leads/[id]/reject` — Reject lead
- `POST /api/leads/[id]/proposal-sent` — Mark proposal sent
- `POST /api/leads/[id]/deal-outcome` — Set deal outcome
- `POST /api/leads/[id]/copilot` — Lead Copilot question
- `POST /api/leads/[id]/proposal/revise` — Revise proposal

**Pipeline**
- `POST /api/pipeline/run` — Run pipeline (body: leadId, reason)
- `POST /api/pipeline/run/[leadId]` — Run pipeline for lead
- `POST /api/pipeline/retry/[leadId]` — Retry failed pipeline
- `POST /api/enrich/[id]` — Enrich lead
- `POST /api/score/[id]` — Score lead
- `POST /api/position/[id]` — Position lead
- `POST /api/propose/[id]` — Generate proposal
- `POST /api/build/[id]` — Build (gate: APPROVED + proposal)

**Artifacts**
- `GET /api/artifacts/[id]` — Get artifact (proposal console)
- `PATCH /api/artifacts/[id]` — Update artifact (sections, toggles)

**Proof / Checklist**
- `GET /api/proof` — Get proof
- `POST /api/proof/generate` — Generate proof
- `GET /api/checklist` — Get checklist
- `POST /api/checklist/generate` — Generate checklist

**Knowledge**
- `GET /api/knowledge` — List knowledge
- `POST /api/knowledge/ingest` — Ingest
- `GET /api/knowledge/queue` — Queue status
- `POST /api/knowledge/queue` — Queue action
- `PATCH /api/knowledge/suggestions/[id]` — Update suggestion

**Learning**
- `GET /api/learning` — List learning
- `POST /api/learning/ingest` — Ingest
- `PATCH /api/learning/proposal/[artifactId]` — Update learning proposal

**YouTube Ingest**
- `POST /api/youtube/ingest/video` — Ingest single video
- `POST /api/youtube/ingest/channel` — Ingest channel
- `GET /api/youtube/jobs` — List jobs
- `GET /api/youtube/transcripts` — List transcripts
- `GET /api/youtube/learning` — List learning proposals
- `POST /api/youtube/learning/:id/promote` — Promote proposal
- `POST /api/youtube/learning/:id/reject` — Reject proposal

**Ops**
- `GET /api/ops/command` — Command/brief
- `POST /api/ops/brief` — Generate brief
- `POST /api/ops/chat` — Ops chat
- `GET /api/ops/feedback` — Feedback
- `POST /api/ops/feedback` — Submit feedback
- `GET /api/ops/settings` — Ops settings
- `POST /api/ops/settings` — Update settings
- `GET /api/ops/monetization` — Monetization
- `PATCH /api/ops/monetization` — Update monetization
- `POST /api/ops/weekly-snapshot` — Weekly snapshot
- `POST /api/ops/workday-run` — Workday run

**Other**
- `GET /api/brief` — Brief
- `GET /api/metrics/conversion` — Conversion metrics
- `GET /api/projects/[id]` — Get project
- `PATCH /api/projects/[id]` — Update project
- `POST /api/projects/github` — GitHub action
- `POST /api/portfolio/[id]` — Portfolio
- `GET /api/followup/[leadId]` — Follow-up
- `POST /api/followup/[leadId]` — Follow-up action
- `POST /api/copilot/lead/[id]` — Legacy copilot
- `POST /api/research/run` — Research run
- `POST /api/capture` — Capture (may be public for site form)
- `POST /api/site/leads` — Site leads (often public)
- `GET /api/proof-assets` — NDA-safe proof assets
- `POST /api/proof-assets` — Create proof asset
- `GET /api/results-ledger` — Results ledger list

---

## 3. Critical user flows (RUNBOOK alignment)

1. **Preflight** — Health 200, ok true, checks (db, pipelineTables, authSecret, nextAuthUrl).
2. **Auth** — Login → dashboard; session persists; protected API returns 401 without cookie.
3. **Create lead → pipeline** — New lead → auto pipeline → enrich, score, position, propose artifacts.
4. **Lead detail** — View lead, artifacts, run pipeline/retry, approve, reject, proposal sent, build (gate). Sales process panel: sales stage, next contact, follow-up, referral ask.
5. **Proposal console** — Open proposal by id → edit sections, 600-char snippet, ready/sent toggles.
6. **Lead Copilot** — Lead detail → ask question → structured response (verdict, nextMove, riskType, whoNeedsToFeelSafe, receipts).
7. **Revise proposal** — Lead detail → revise with instruction → new proposal artifact.
8. **Metrics** — Dashboard metrics → runs, step success, RUN_REPORT.
9. **Idempotency** — Re-run pipeline on same lead → no duplicate artifacts; lock prevents concurrent run.
10. **Gates** — Build only when APPROVED + proposal artifact; PATCH cannot set status/approvedAt/build*/proposalSentAt/dealOutcome.
11. **Retry** — Failed run → POST pipeline/retry/[leadId] → new run or locked/not_eligible.
12. **Research** — Research run creates leads with RESEARCH_SNAPSHOT, pipeline auto-triggers, proposals reference "why now."
13. **Knowledge/Learning ingest** — Ingest video → transcript → summary → insights/suggestions → human review.
14. **Client Success** — For APPROVED/BUILDING/SHIPPED: result target, baseline, interventions, outcome scorecard, proof from outcomes.

---

## 4. Test coverage (current)

### Tier A — Automated (Playwright)

- **smoke.spec.ts** — GET /api/health 200, ok true, checks.
- **api-auth.spec.ts** — 401 without auth: leads, artifacts, proof, checklist, knowledge, learning, brief, ops/command, pipeline/run, copilot, proof/generate, checklist/generate; health public 200.
- **proof-api.spec.ts** — Proof/checklist generate 401 without auth.
- **lead-copilot.spec.ts** — Copilot 401 without auth; (optional) lead detail + Ask Copilot UI.
- **pages.spec.ts** — Login + visit dashboard, proposals, deploys, metrics, settings, leads/new, home.
- **full-flow.spec.ts** — Login → dashboard → metrics → new lead → metrics (enrich visible).
- **sales-layer.spec.ts** — Sales process, follow-up discipline, referral flows.
- **client-acquisition.spec.ts** — Channel ROI, networking events, proof asset flows.
- **learning-ingest.spec.ts** — Learning/knowledge ingest flows.

### Tier B — Manual production checks (MCP browser / real browser)

Run after every deploy and weekly. See `docs/TESTING_SIDE_PANEL.md` for full checklists.

**Core checks:**
- `/api/health` → 200, ok true, all checks green
- Login → dashboard loads with live data
- Command Center → scorecard, failures, constraint render
- One lead detail → artifacts visible, pipeline actions work
- Proposals → list loads, follow-up queue visible
- Metrics → runs visible with step timings
- Settings → sections load, toggles work

**Gaps to cover:**
- All dashboard pages (command, chat, knowledge, learning, proof, checklist, conversion, ops-health, sales-leak, results).
- API 401 tests for a representative set of protected endpoints.
- Optional: lead detail and proposal detail by id (with real id from DB or fixture).

---

## 5. Test suite summary

| Suite | Tests | Purpose |
|-------|-------|---------|
| **smoke.spec.ts** | 1 | GET /api/health 200, ok true, all checks (db, pipelineTables, authSecret, nextAuthUrl) |
| **api-auth.spec.ts** | 15 | 401 without auth: leads, artifacts, proof, checklist, knowledge, learning, brief, ops/command, pipeline/run, copilot, proof/generate, checklist/generate; health public 200 |
| **proof-api.spec.ts** | 4 | Proof/checklist generate 401; proof get 401 |
| **lead-copilot.spec.ts** | 3 | Copilot 401; (with login) lead detail + Ask Copilot UI |
| **pages.spec.ts** | 2 | (With login) visit all 15+ static pages; (optional) lead detail + proposal console when E2E_LEAD_ID / E2E_PROPOSAL_ARTIFACT_ID set |
| **full-flow.spec.ts** | 1 | (With login) login → dashboard → metrics → new lead → metrics |
| **sales-layer.spec.ts** | — | Sales process, follow-up, referral flows |
| **client-acquisition.spec.ts** | — | Channel ROI, networking, proof assets |
| **learning-ingest.spec.ts** | — | Learning/knowledge ingest flows |

**Without login:** 21 tests run, 21 pass (all API auth + health).  
**With login:** Set `E2E_EMAIL` and `E2E_PASSWORD` (or `AUTH_DEV_PASSWORD=changeme` and any email + `changeme`) so the login-dependent tests run and pass.

---

## 6. How to run full test suite

### Tier A — Automated

```bash
# With app already running (e.g. npm run dev on port 3000)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e

# With credentials for login-dependent tests (all 26+ tests)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  E2E_EMAIL=your@email.com E2E_PASSWORD=yourpassword \
  npm run test:e2e
```

Smoke only:
```bash
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/smoke.spec.ts
# Or: npm run smoke (starts server with PIPELINE_DRY_RUN=1)
```

### Tier B — Production manual

```bash
# Post-deploy smoke (curl-based)
./scripts/smoke-test.sh https://evenslouis.ca
```

Then manually (MCP browser or real browser):
1. Log in at `https://evenslouis.ca/login`
2. Visit Command Center, Leads, Proposals, Metrics, Settings
3. Open one lead detail — verify artifacts and actions
4. Check Failures & Interventions — no unexpected stuck items

**Public endpoints (no auth):** `GET /api/health`. `POST /api/capture` and `POST /api/site/leads` are intended for public form submission (no 401 test).

---

## 7. Production audit (same flows, prod URL)

After deploy, run the same full audit and test against production:

```bash
# 1) Post-deploy smoke (homepage, login, dashboard, health, ops/command, SSL)
./scripts/smoke-test.sh https://evenslouis.ca

# 2) Full E2E suite against prod (21 tests run without login; 5 need E2E_EMAIL/E2E_PASSWORD for login flows)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca npm run test:e2e
```

**Expected:** Smoke script exit 0; 21 E2E tests pass, 5 skip (login). To run all 26+ against prod, set `E2E_EMAIL` and `E2E_PASSWORD` to valid production credentials.

### Manual production verification (MCP browser or real browser)

After automated tests pass, do a manual walkthrough of the production app:

1. **Health:** `curl -s https://evenslouis.ca/api/health` → 200, ok true
2. **Login:** Log in → dashboard loads, no redirect loop
3. **Command Center:** Scorecard renders current data, Failures card shows or is empty, Brief Me generates
4. **Lead detail:** Open a recent lead → artifacts present, Copilot answerable, sales process panel renders
5. **Proposals:** List loads, follow-up queue visible
6. **Metrics:** Runs visible, step timings populated
7. **Knowledge/Learning:** Pages load, suggestions/proposals visible
8. **Settings:** All sections render, monetization map visible

This catches real-world issues automated tests cannot: auth cookie behavior, network latency, live data rendering, UX feel, and third-party integration status.

---

## 8. What to test on each major page

For each page, verify: (1) loads without error, (2) data renders (not blank cards), (3) primary actions work, (4) no console errors.

| Page | Primary data to verify | Primary action to verify |
|------|----------------------|------------------------|
| **Command Center** | Money Scorecard (cash, leads, proposals, deals), Failures card, Constraint, Pat/Tom Scorecard, Leverage Score | Brief Me generates, Workday Run starts |
| **Leads** | List of leads with titles, status, sales stage | Search, filter, open lead detail |
| **Lead Detail** | Artifacts list, pipeline status, sales process panel, client success (if applicable) | Run/retry pipeline, approve, revise proposal, Copilot ask |
| **Proposals** | List of proposals, follow-up queue | Open proposal console, mark sent |
| **Proposal Console** | Sections render, snippet, ready/sent toggles | Edit section, toggle ready |
| **Metrics** | Pipeline runs with step timings, RUN_REPORT links | Filter by date, view run details |
| **Chat** | Message input, response area | Send message, verify receipts block (Known/Inferred/Missing) |
| **Knowledge** | Queue, suggestions, transcripts/insights counts | Ingest video URL (with mock), review suggestion |
| **Learning** | Proposals list, promote/produced dropdowns | Ingest, promote to playbook, set produced tag |
| **Proof** | Lead selector, generated proof posts | Generate proof, copy |
| **Checklist** | Keyword input, generated checklist | Generate, copy |
| **Settings** | All sections (research, automation, monetization, guardrails) | Toggle setting, save |
| **Ops Health** | Failures, stale leads, integration health, approval queue | Link to lead from failure |
| **Sales Leak** | Stage counts, leak identification, follow-up discipline | Review evidence per stage |
| **Results** | Active/shipped clients with target/baseline/delta | Open client detail |
| **Conversion** | Funnel metrics | — |
| **Deploys** | Deploy history | — |
| **YouTube** | Ingest jobs, transcripts, learning proposals | Ingest video URL, promote/reject proposal |
| **Build Ops** | Agent tasks, build queue | Create task, review, approve |

---

*For step-by-step E2E test runbook, see `docs/RUNBOOK.md`. For testing strategy and operator checklists, see `docs/TESTING_SIDE_PANEL.md`. For deploy steps, see `docs/VPS_DEPLOY_CHECKLIST.md`.*
