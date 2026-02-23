# Testing Strategy: Local Automated + Production Manual

Two-tier testing keeps the app safe and the operator confident. **Automated tests** catch regressions fast. **Manual production checks** (MCP browser or real browser) catch auth quirks, network latency, UX, and real-world behavior that automation cannot.

---

## Tier A — Automated tests (Playwright / local)

**Purpose:** Fast repeatability. Run after every code change, before every deploy.

### How to run

```bash
# Full suite (app running on port 3000)
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e

# Full suite with login-dependent tests
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  E2E_EMAIL=your@email.com E2E_PASSWORD=yourpassword \
  npm run test:e2e

# Smoke only
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/smoke.spec.ts

# Dry-run (no OpenAI)
PIPELINE_DRY_RUN=1 npm run smoke
```

### What automated tests cover

| Suite | Tests | What it checks |
|-------|-------|----------------|
| **smoke.spec.ts** | 1 | GET /api/health 200, ok true, all checks |
| **api-auth.spec.ts** | 15 | 401 without auth on protected endpoints |
| **proof-api.spec.ts** | 4 | Proof/checklist generate 401 |
| **lead-copilot.spec.ts** | 3 | Copilot 401; lead detail + Ask Copilot UI |
| **pages.spec.ts** | 2 | Visit all 15+ static dashboard pages |
| **full-flow.spec.ts** | 1 | Login → dashboard → metrics → new lead → metrics |
| **sales-layer.spec.ts** | — | Sales process, follow-up, referral flows |
| **client-acquisition.spec.ts** | — | Channel ROI, networking, proof asset flows |
| **learning-ingest.spec.ts** | — | Learning/knowledge ingest flows |

### When to run automated tests

- Before every deploy (mandatory)
- After any code change to API routes, pipeline, or auth
- After dependency updates
- As part of CI (if configured)

### Against production

```bash
# Post-deploy smoke (curl-based, no login required)
./scripts/smoke-test.sh https://evenslouis.ca

# Full E2E suite against prod
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca npm run test:e2e

# With prod login credentials
USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=https://evenslouis.ca \
  E2E_EMAIL=your@email.com E2E_PASSWORD=yourpassword \
  npm run test:e2e
```

---

## Tier B — Manual production checks (MCP browser / real browser)

**Purpose:** Catch what automation misses — real-world auth, network latency, UX feel, data rendering with live data, SSL, third-party integrations.

### When to do manual checks

- After every production deploy
- Weekly (as part of the night operator loop)
- When something "feels off" — slow pages, weird data, missing cards
- Before showing the app to anyone (clients, partners, advisors)

### How to do production checks

1. **MCP browser** (preferred for Cursor/agent context): Use the MCP browser tool to navigate production pages, verify content renders, check for errors.
2. **Real browser** (Chrome/Safari): Open `https://evenslouis.ca`, log in, navigate manually. Use DevTools Network tab for latency and Console for errors.
3. **Side-panel browser** (Cursor embedded): Works for local (`localhost:3000`). For production, side-panel login may fail due to embedded auth/cookie restrictions — use MCP browser or real browser instead.

### Known limitation: embedded browser + production auth

The Cursor side-panel browser may show `chrome-error://chromewebdata/` on production login due to cookie/redirect behavior in embedded contexts. This is not an app bug. Use MCP browser or a real browser tab for production auth flows.

---

## What to test on each major page

Test these in order for consistency. For each page, check: loads without blank/error, data cards render, no console errors, actions work.

### Core pages (always test)

| Page | Route | What to verify |
|------|-------|---------------|
| **Health** | `GET /api/health` | 200, `ok: true`, all checks green (db, pipelineTables, authSecret, nextAuthUrl) |
| **Login** | `/login` | Form renders, login succeeds, redirects to dashboard, no loop |
| **Command Center** | `/dashboard/command` | Scorecard loads, Failures card loads, Brief Me works, cards render data |
| **Leads** | `/dashboard/leads` | List loads, search/filter works, lead count visible |
| **Lead Detail** | `/dashboard/leads/[id]` | Artifacts load, pipeline actions visible, Copilot works, sales process panel renders |
| **Proposals** | `/dashboard/proposals` | List loads, follow-up queue visible |
| **Proposal Console** | `/dashboard/proposals/[id]` | Sections editable, 600-char snippet, ready/sent toggles |
| **Metrics** | `/dashboard/metrics` | Runs visible, step timings, RUN_REPORT link |
| **Settings** | `/dashboard/settings` | All sections load, toggles work, monetization map renders |

### Secondary pages (test weekly or after changes)

| Page | Route | What to verify |
|------|-------|---------------|
| **Chat** | `/dashboard/chat` | Message sends, response includes receipts (Known/Inferred/Missing) |
| **Learning** | `/dashboard/learning` | Ingest form renders, proposals list loads, promote/produced dropdowns |
| **Knowledge** | `/dashboard/knowledge` | Queue visible, suggestions load, ingest works (with mock if no provider) |
| **Proof** | `/dashboard/proof` | Lead selector, generate works, copy button |
| **Checklist** | `/dashboard/checklist` | Generate works, copy button |
| **Conversion** | `/dashboard/conversion` | Metrics render |
| **Deploys** | `/dashboard/deploys` | Page loads |
| **Ops Health** | `/dashboard/ops-health` | Panel loads with failures, stale leads, integration health |
| **Sales Leak** | `/dashboard/sales-leak` | Stage counts, leak identification, evidence |
| **Results** | `/dashboard/results` | Active/shipped clients, target/baseline/delta |
| **YouTube** | `/dashboard/youtube` | Ingest jobs, transcripts, proposals, provider chain status |
| **Build Ops** | `/dashboard/build-ops` | Build tasks, agent runs, risk levels |

---

## End-to-end workflow validation

The full money path: **Research → Ingest → Enrich → Score → Position → Propose → Approve → Build**. Validate this works end-to-end periodically (weekly or after pipeline changes).

### Local (automated or manual)

1. Create a lead (UI or `POST /api/leads`)
2. Confirm pipeline auto-triggers (check `/dashboard/metrics` for new run)
3. Verify artifacts: enrichment, score, positioning brief, proposal
4. Open lead detail — artifacts visible, Copilot answerable
5. Revise proposal — new artifact created, positioning unchanged
6. Approve lead — requires proposal artifact
7. Build — requires APPROVED + proposal + no existing project

### Production (manual MCP browser or real browser)

1. Verify `/api/health` returns 200 with all checks green
2. Log in → Command Center loads with live data
3. Open a recent lead → artifacts present, pipeline ran
4. Check Metrics → runs visible with step timings
5. Verify Brief Me generates a current briefing
6. Check Failures & Interventions — no unexpected stuck items

---

## Inputs / Processing / Outputs visibility checks

For each pipeline stage, verify the operator can see what went in, what happened, and what came out.

| Stage | Input visible? | Processing visible? | Output visible? |
|-------|---------------|--------------------|-----------------| 
| **Capture** | Lead title, description, contact, source | Lead created event | Lead in list, source channel |
| **Research** | RESEARCH_SNAPSHOT artifact with source URL | RESEARCH_RUN_REPORT counts | New leads with research artifacts |
| **Enrich** | Lead description + research snapshot | Pipeline run step timing | AI Enrichment Report artifact |
| **Score** | Enrichment data | Score step in run | `lead.scoredAt`, score visible |
| **Position** | Enrichment + score | Position step timing | POSITIONING_BRIEF artifact |
| **Propose** | Positioning + enrichment + ROI + research | Propose step timing | Proposal artifact(s) |
| **Approve** | Proposal artifact | Human clicks approve | `lead.status = APPROVED` |
| **Build** | Approved lead + proposal | Build step | Project created |

---

## Rollback / no-deploy safety

Before deploying, always have a rollback plan. See `docs/DEPLOY_SSH_SETUP.md` for rollback commands.

**Decision: deploy or hold?**

- All automated tests pass locally → proceed
- Smoke test against staging (if available) passes → proceed
- Any auth, pipeline, or money-path test fails → **do not deploy**
- Build or lint fails → **do not deploy**
- If deployed and health check fails → **rollback immediately** (`git reset --hard HEAD~1 && bash deploy.sh`)

**Safe deploy sequence:**

1. `npm run build && npm run lint` — both exit 0
2. `npm run test:e2e` — all tests pass
3. Deploy (push + deploy script)
4. `./scripts/smoke-test.sh https://evenslouis.ca` — exit 0
5. Manual MCP browser: login, Command Center, one lead detail
6. If anything fails → rollback (see DEPLOY_SSH_SETUP.md)

---

## Night Operator Checklist (10–15 min)

> Standalone version: [NIGHT_OPERATOR_CHECKLIST.md](NIGHT_OPERATOR_CHECKLIST.md)

Run this after your day job, before you close the laptop. Goal: confirm the system ran correctly while you were away and nothing is stuck.

- [ ] **Health:** `curl -s https://evenslouis.ca/api/health` → 200, ok true
- [ ] **Login:** Open prod in browser/MCP browser, log in, reach dashboard
- [ ] **Command Center:** Read the Money Scorecard — cash, leads, proposals, deals. Any number wrong?
- [ ] **Failures & Interventions:** Any failed runs, stale leads, stuck proposals? Triage or note for tomorrow
- [ ] **Brief Me:** Click Brief Me, read the summary. What happened today? Any surprises?
- [ ] **Metrics:** Open `/dashboard/metrics`. Did runs complete? Any errors in last 24h?
- [ ] **Proposals:** Any new proposals ready to review? Revise or mark for tomorrow
- [ ] **Follow-up queue:** Any overdue follow-ups? Note or handle now
- [ ] **Knowledge/Learning:** Any new suggestions from today's ingestion? Skim and dismiss/note
- [ ] **Constraint:** What is the current bottleneck? Is it the same as last week? If stuck, note action for tomorrow
- [ ] **Quick sanity:** Open one lead detail → artifacts present, page renders, no errors

**Time budget:** 10–15 min. If it takes longer, something is broken — log it and fix tomorrow.

---

## Before Clients Checklist

> Standalone version: [BEFORE_CLIENTS_CHECKLIST.md](BEFORE_CLIENTS_CHECKLIST.md)

Run this before any client call, demo, or proposal send. Goal: the app looks professional and data is current.

- [ ] **Health check passes:** `/api/health` → 200, all green
- [ ] **Command Center loads:** Scorecard, failures, constraint — all rendering with current data
- [ ] **Target lead/proposal loads:** Open the specific lead(s) you'll reference. Artifacts present, proposal content correct
- [ ] **Proposal console:** Open the relevant proposal. Sections render, snippet correct, no stale data
- [ ] **No visible errors:** Console clean on the pages you'll show (if screensharing)
- [ ] **Proof page loads:** If you'll reference proof/case patterns, verify they render
- [ ] **Client Success:** For active/shipped clients being discussed, verify Results Ledger shows current target/baseline/delta
- [ ] **Sensitive data check:** No client names in wrong places, NDA-safe content only in shared views

---

## After Deploy Smoke Checklist

> Standalone version: [AFTER_DEPLOY_SMOKE_CHECKLIST.md](AFTER_DEPLOY_SMOKE_CHECKLIST.md)

Run immediately after every production deploy. Goal: confirm nothing broke.

- [ ] **Smoke script:** `./scripts/smoke-test.sh https://evenslouis.ca` → exit 0
- [ ] **Health endpoint:** `curl -s https://evenslouis.ca/api/health` → 200, ok true, all checks green
- [ ] **Login:** Log in via real browser or MCP browser → dashboard loads
- [ ] **Command Center:** Scorecard renders, Failures card renders, data is not stale
- [ ] **One lead detail:** Open any lead → artifacts load, pipeline actions visible
- [ ] **Proposals page:** List loads, at least one proposal visible (if any exist)
- [ ] **Metrics:** Page loads, recent runs visible
- [ ] **API auth:** `curl -s https://evenslouis.ca/api/leads` → 401 (no cookie = good)
- [ ] **SSL:** Certificate valid (smoke-test.sh checks this for HTTPS)
- [ ] **Rollback ready:** If any check fails, rollback: `ssh root@server 'cd /root/client-engine && git reset --hard HEAD~1 && bash deploy.sh'`

---

## When App Feels Slow (troubleshooting checklist)

> Standalone version: [WHEN_APP_FEELS_SLOW_CHECKLIST.md](WHEN_APP_FEELS_SLOW_CHECKLIST.md)

When pages take too long or the app feels sluggish, inspect in this order.

### 1. Server health (check first)
- [ ] `curl -s https://evenslouis.ca/api/health` — does it respond quickly (<2s)? If slow, server is overloaded
- [ ] SSH into server: `top` or `htop` — is CPU/memory maxed?
- [ ] Check disk: `df -h` — is disk full?
- [ ] Check Node process: is it running? `pm2 status` or `systemctl status` (whichever you use)

### 2. Database
- [ ] Check DB connection: health endpoint checks this — if `db.ok: false`, DB is the problem
- [ ] Large tables: are PipelineRun or Artifact tables growing too large? Check row counts
- [ ] Missing indexes: if lead list or metrics pages are slow, check Prisma query logs

### 3. Network / SSL
- [ ] Is it slow from your location or everywhere? Try from a different network
- [ ] SSL certificate valid? `echo | openssl s_client -servername evenslouis.ca -connect evenslouis.ca:443 2>/dev/null | openssl x509 -noout -dates`
- [ ] DNS resolving correctly? `nslookup evenslouis.ca`

### 4. Specific page slow
- [ ] **Command Center slow:** Likely the data aggregation queries (scorecard, failures, constraint). Check server logs for slow queries
- [ ] **Metrics slow:** Large number of pipeline runs. Consider pagination or limiting date range
- [ ] **Lead detail slow:** Many artifacts on one lead. Check artifact count
- [ ] **Chat slow:** LLM response time. Check OpenAI status page
- [ ] **Knowledge/Learning ingest slow:** Transcript fetch or LLM summarization. Check provider status

### 5. Pipeline / background
- [ ] Is a pipeline run stuck? Check `/dashboard/metrics` for running-but-not-finishing runs
- [ ] Is the research cron running too frequently? Check cron logs
- [ ] Worker (if using email ingestion): is Redis up? Is the worker process running?

### 6. Quick fixes
- [ ] Restart the app: `pm2 restart all` or `systemctl restart client-engine`
- [ ] Clear Next.js cache: `rm -rf .next/cache && npm run build && npm run start`
- [ ] If DB is the bottleneck: `npx prisma db push` (re-sync schema), check for missing indexes

---

## Quick reference: local vs production testing

| What | Local (Tier A) | Production (Tier B) |
|------|---------------|---------------------|
| **Tool** | Playwright, terminal, localhost browser | MCP browser, real browser, curl, smoke script |
| **Auth** | Dev bypass (`AUTH_DEV_PASSWORD`) or test credentials | Real admin credentials |
| **Data** | Seed data or dry-run placeholders | Live production data |
| **Speed** | Fast, repeatable, automated | Slower, manual, catches real-world issues |
| **Catches** | Regressions, broken routes, auth gates, API contracts | Auth quirks, latency, UX, data rendering, SSL, network |
| **When** | Every code change, before deploy | After deploy, weekly, before clients |

---

*For the full E2E test runbook (step-by-step), see `docs/RUNBOOK.md`. For route and API inventory, see `docs/AUDIT_AND_TEST_FLOWS.md`. For deploy steps, see `docs/VPS_DEPLOY_CHECKLIST.md`. For rollback, see `docs/DEPLOY_SSH_SETUP.md`.*
