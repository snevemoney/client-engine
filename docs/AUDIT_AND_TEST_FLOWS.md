# Full Audit & Test Flows

**Purpose:** Single reference for every page, API, and user flow. Use for full regression and “no corners missed” testing.

---

## 1. App routes (pages)

| Route | Description | Protected |
|-------|-------------|-----------|
| `/` | Home/landing | No |
| `/login` | Sign in | No (redirects to /dashboard if logged in) |
| `/dashboard` | Dashboard home (command) | Yes |
| `/dashboard/leads` | Leads list | Yes |
| `/dashboard/leads/new` | New lead form | Yes |
| `/dashboard/leads/[id]` | Lead detail (artifacts, Copilot, pipeline actions) | Yes |
| `/dashboard/proposals` | Proposals list | Yes |
| `/dashboard/proposals/[id]` | Proposal console (edit sections, toggles) | Yes |
| `/dashboard/metrics` | Pipeline metrics | Yes |
| `/dashboard/command` | Command center / brief | Yes |
| `/dashboard/ops-health` | Ops health | Yes |
| `/dashboard/sales-leak` | Sales leak | Yes |
| `/dashboard/results` | Results ledger | Yes |
| `/dashboard/build-ops` | Build ops | Yes |
| `/dashboard/chat` | Ops chat | Yes |
| `/dashboard/knowledge` | Knowledge engine | Yes |
| `/dashboard/learning` | Learning engine | Yes |
| `/dashboard/proof` | Proof / portfolio | Yes |
| `/dashboard/checklist` | Checklist | Yes |
| `/dashboard/conversion` | Conversion metrics | Yes |
| `/dashboard/deploys` | Deploys | Yes |
| `/dashboard/settings` | Settings | Yes |
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

---

## 3. Critical user flows (RUNBOOK alignment)

1. **Preflight** — Health 200, ok true, checks (db, pipelineTables, authSecret, nextAuthUrl).
2. **Auth** — Login → dashboard; session persists; protected API returns 401 without cookie.
3. **Create lead → pipeline** — New lead → auto pipeline → enrich, score, position, propose artifacts.
4. **Lead detail** — View lead, artifacts, run pipeline/retry, approve, reject, proposal sent, build (gate).
5. **Proposal console** — Open proposal by id → edit sections, 600-char snippet, ready/sent toggles.
6. **Lead Copilot** — Lead detail → ask question → structured response (verdict, nextMove, riskType, whoNeedsToFeelSafe, receipts).
7. **Revise proposal** — Lead detail → revise with instruction → new proposal artifact.
8. **Metrics** — Dashboard metrics → runs, step success, RUN_REPORT.
9. **Idempotency** — Re-run pipeline on same lead → no duplicate artifacts; lock prevents concurrent run.
10. **Gates** — Build only when APPROVED + proposal artifact; PATCH cannot set status/approvedAt/build*/proposalSentAt/dealOutcome.
11. **Retry** — Failed run → POST pipeline/retry/[leadId] → new run or locked/not_eligible.

---

## 4. Test coverage (current)

- **smoke.spec.ts** — GET /api/health 200, ok true, checks.
- **proof-api.spec.ts** — Proof/checklist generate 401 without auth.
- **lead-copilot.spec.ts** — Copilot 401 without auth; (optional) lead detail + Ask Copilot UI.
- **pages.spec.ts** — Login + visit all dashboard pages (command, ops-health, sales-leak, results, leads, proposals, build-ops, metrics, work, chat, learning, settings, proof, checklist, deploys, conversion, knowledge), leads/new, home.
- **full-flow.spec.ts** — Login → dashboard → metrics → new lead → metrics (enrich visible).
- **prod.spec.ts** — Production audit: health + DB checks, every page, silent-fail API checks, key flow, render speed (see §8).

**Gaps to cover (this audit):**
- API 401 tests for a representative set of protected endpoints (api-auth.spec.ts covers many).
- Optional: lead detail and proposal detail by id (with real id from DB or fixture).

---

## 5. Test suite summary (after full audit)

| Suite | Tests | Purpose |
|-------|-------|---------|
| **smoke.spec.ts** | 1 | GET /api/health 200, ok true, all checks (db, pipelineTables, authSecret, nextAuthUrl) |
| **api-auth.spec.ts** | 15 | 401 without auth: leads, artifacts, proof, checklist, knowledge, learning, brief, ops/command, pipeline/run, copilot, proof/generate, checklist/generate; health public 200 |
| **proof-api.spec.ts** | 4 | Proof/checklist generate 401; proof get 401 |
| **lead-copilot.spec.ts** | 3 | Copilot 401; (with login) lead detail + Ask Copilot UI |
| **pages.spec.ts** | 2 | (With login) visit all 15 static pages; (optional) lead detail + proposal console when E2E_LEAD_ID / E2E_PROPOSAL_ARTIFACT_ID set |
| **full-flow.spec.ts** | 1 | (With login) login → dashboard → metrics → new lead → metrics |

**Without login:** 21 tests run, 21 pass (all API auth + health).  
**With login:** Set `E2E_EMAIL` and `E2E_PASSWORD` (or `AUTH_DEV_PASSWORD=changeme` and any email + `changeme`) so the 5 login-dependent tests run and pass.

---

## 6. How to run full test suite

```bash
# With app already running (e.g. npm run dev on port 3000)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e

# With credentials for login-dependent tests (all 26 tests)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  E2E_EMAIL=your@email.com E2E_PASSWORD=yourpassword \
  npm run test:e2e
```

Smoke only:
```bash
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/smoke.spec.ts
# Or: npm run smoke (starts server with PIPELINE_DRY_RUN=1)
```

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

**Expected:** Smoke script exit 0; 21 E2E tests pass, 5 skip (login). To run all 26 against prod, set `E2E_EMAIL` and `E2E_PASSWORD` to valid production credentials.

---

## 8. Production full audit (every page, flows, DB, silent fails, speed)

**prod.spec.ts** runs a dedicated production checklist:

| What | How |
|------|-----|
| **Health + DB** | GET /api/health 200, ok true, checks.db + checks.pipelineTables + authSecret + nextAuthUrl |
| **Every page** | Login, then visit all 21 routes (/, /login, all dashboard + /work); expect status &lt; 500, body visible |
| **Silent fails** | After login: GET /api/leads → 200 and body is array; GET /api/ops/command → 200 and body is object/array |
| **Key flow** | Login → metrics → new lead → metrics shows "enrich" (pipeline ran) |
| **Render speed** | Critical pages (command, leads, metrics) must load within 15s (domcontentloaded) |

Run against production (with valid credentials so login-dependent tests run):

```bash
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca \
  E2E_EMAIL=your@email.com E2E_PASSWORD=yourpassword \
  npm run test:e2e tests/e2e/prod.spec.ts
```

Without credentials, health + public-pages tests run; every-page, silent-fail, flow and speed tests are skipped (login required).
