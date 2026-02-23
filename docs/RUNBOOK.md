# Runbook: Full E2E test (production-grade audit)

Two testing tiers. **Tier A (automated):** Playwright tests for fast repeatability. **Tier B (manual production):** MCP browser or real browser for real-world behavior, auth quirks, latency, UX. See `docs/TESTING_SIDE_PANEL.md` for the full testing strategy and checklists.

Do this in Cursor in **this order**. Use terminal for API/scripts. Use localhost browser for local UI steps. Use MCP browser or real browser for production UI steps.

---

## 1) Preflight (env + server + health)

**Tier A — Automated / Terminal:**

1. Confirm env is loaded (required for app + auth + pipeline):
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `NEXTAUTH_URL` (local: `http://localhost:3000`)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   - `OPENAI_API_KEY` (or use dry-run for E2E without LLM)
2. DB tables exist:
   - `npx prisma db push`
   - `npx prisma db seed`
3. Start app:
   - `npm run dev` (from repo root so all paths resolve)
4. Health check (automated):
   ```bash
   curl -s http://localhost:3000/api/health
   ```
   Must return **200** with `ok: true` and all checks true (db, pipelineTables, authSecret, nextAuthUrl).

**Tier B — Manual production (MCP browser or real browser):**

1. `curl -s https://evenslouis.ca/api/health` → 200, ok true, all checks green
2. Open `https://evenslouis.ca/api/health` in MCP browser and verify JSON response

**Fail conditions to catch here:**

- Redirect loop on /login → fix NEXTAUTH_URL / AUTH_SECRET.
- Missing AUTH_SECRET / NEXTAUTH_URL → health or login will fail.
- DB not reachable or pipeline tables missing → health checks false; run `prisma db push`.

---

## 2) Auth + RBAC (login + protected routes)

**Tier A — Automated (Playwright):**

- `pages.spec.ts` tests login → dashboard flow
- `api-auth.spec.ts` tests 401 on protected endpoints without auth

**Tier A — Manual local:**

1. Go to **http://localhost:3000/login** and sign in with admin creds (or dev bypass: any email + `AUTH_DEV_PASSWORD`).
2. Confirm **/dashboard** loads; no redirect loop; session persists after refresh.
3. (Optional) In a private window or after sign-out, hit a protected pipeline endpoint → must get **401**.

**Tier B — Manual production (MCP browser):**

1. Open `https://evenslouis.ca/login` in MCP browser or real browser
2. Log in with production admin credentials
3. Confirm `/dashboard` loads with live data, no redirect loop
4. Refresh the page — session persists
5. Note: Cursor side-panel may fail on production login (embedded cookie issue). Use MCP browser or real browser instead.

**Fail conditions:**

- Credentials not working → run `npm run reset-auth` on the VPS, check ADMIN_EMAIL/ADMIN_PASSWORD.
- Middleware blocking /api/auth/* or session user missing on protected endpoints → fix auth config.

---

## 3) Core pipeline E2E (manual lead → auto pipeline → artifacts)

**Tier A — Automated (Playwright):**

- `full-flow.spec.ts`: login → dashboard → metrics → new lead → metrics (enrich visible)

**Tier A — Manual local:**

1. Create a lead from **New Lead** (e.g. title "E2E Lead 001", description "Need automation for booking + invoicing", contact email any).
2. Open that lead's detail page.
3. Confirm artifacts appear (or after refresh):
   - enrichment (AI Enrichment Report)
   - score (lead.scoredAt set)
   - positioning brief (POSITIONING_BRIEF)
   - proposal
4. Open **/dashboard/metrics** and confirm:
   - A new run exists for that lead.
   - Step timings populated (enrich → score → position → propose).
   - RUN_REPORT.md artifact exists for that run.

**Tier B — Manual production (MCP browser):**

1. Open a recent lead in production → verify artifacts are present
2. Check `/dashboard/metrics` → runs completed with step timings
3. Verify Brief Me on Command Center generates a current briefing referencing recent pipeline activity
4. Check that research-sourced leads (if any) have RESEARCH_SNAPSHOT artifacts

**Fail conditions:**

- Pipeline doesn't trigger on lead creation → check POST /api/leads fires `runPipelineIfEligible(leadId, "lead_created")`.
- Steps run but don't write artifacts → check step success + artifact create in orchestrator.
- Step failure doesn't record notes/error codes → check error classifier + finishStep(notes).
- Metrics page errors → check PipelineRun/PipelineStepRun exist and query.

---

## 4) Idempotency + locks (double-run attempts)

**Tier A — Manual local (hard to automate):**

1. **Idempotency:** On the same lead, hit "Run pipeline" / "Retry pipeline" again.
   - **Expected:** Steps that already have artifacts are **skipped**; no duplicate enrichment/score/positioning/proposal (unless you explicitly revised).
2. **Concurrency:** Trigger pipeline twice quickly on the **same** lead (e.g. two retry requests back-to-back).
   - **Expected:** One run proceeds; the other gets `run: false, reason: "locked"` (or equivalent). No duplicate artifacts.

**Pass criteria:**

- No duplicate artifacts.
- Runs show skipped steps or clear no-op behavior.

---

## 5) Gate tests (money-path locks are real)

**Tier A — Manual local or automated:**

**Build gate:**

1. On a lead that is **not** approved: try **Build** → must return **403** (and message about APPROVED).
2. Approve the lead; then (if you can simulate) ensure **no** proposal artifact for that lead and try Build → must return **403** ("No proposal artifact" or equivalent).

**Approve gate:**

- Approve should require at least one proposal artifact (API returns 400 if none).

**PATCH bypass test (terminal):**

```bash
curl -s -X PATCH "http://localhost:3000/api/leads/LEAD_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED","approvedAt":"2020-01-01T00:00:00.000Z"}'
```

- **Expected:** **400** and message that field(s) cannot be updated via PATCH.

**Tier B — Production verification:**

- Verify the same gates exist in production by attempting (with curl or MCP browser) to access gated actions on a non-approved lead.

**Critical fail condition:**

- Anything that lets you build without **APPROVED** + **proposal artifact** is a security hole.

---

## 6) Revise loop (proposal iteration)

**Tier A — Manual local:**

1. On lead detail, use **Revise proposal** with an instruction (e.g. "Make it shorter, stronger hook, add 3 proof bullets, keep problem-first").
2. Verify:
   - A **new** proposal artifact is created.
   - Positioning brief **remains the same**.
   - Proposal content reflects the instruction and does not invent facts not in lead/snapshot.

**Tier B — Production spot check:**

- Open a lead in production that has multiple proposal revisions. Verify the latest proposal is visible and prior versions exist as separate artifacts.

---

## 7) Retry behavior (simulate retryable failure)

**Safe way:** Temporarily use an invalid OpenAI key or a controlled dev error for one step.

1. Trigger pipeline (create a new lead or retry an existing one).
2. Confirm:
   - Run status = error.
   - `retryCount` increments **only** for retryable codes (e.g. OPENAI_429, OPENAI_5XX, OPENAI_NETWORK).
   - `lastErrorCode` / `lastErrorAt` set on the run.
   - RUN_REPORT.md includes last failed step + notes (with error code prefix).
3. Call **POST /api/pipeline/retry/[leadId]** (with auth).
   - **Expected:** Either a new run starts (`run: true`) or a clear response (`run: false`, reason: not_eligible/locked, details).

---

## 8) Worker paths (optional; for "while I'm at my 9–5")

If you use email ingestion / background jobs:

1. Start Redis if required (or confirm worker isn't needed for your flow).
2. Run worker: `npm run worker`.
3. Verify ingestion creates a lead, triggers pipeline, and creates artifacts (e.g. send a test email or trigger ingestion once).

---

## 9) Research snapshot → "why now" (R1 proof)

**Terminal:**

```bash
node scripts/create-research-lead.mjs
```

- Prints the new lead ID.

**Tier A — Local:**

1. Open **http://localhost:3000/dashboard/leads/LEAD_ID** (use printed id).
2. Trigger **Run pipeline** / **Retry pipeline** (or wait if auto-trigger on create is wired).
3. Confirm proposal uses "why now" from the RESEARCH_SNAPSHOT (e.g. urgency, tools mentioned) without inventing facts.

**Tier B — Production:**

- Verify that research-sourced leads in production have RESEARCH_SNAPSHOT artifacts and proposals reference the research context.

---

## 10) End-to-end workflow validation

Validate the full pipeline path works as a connected chain, not just individual steps.

**Full path:** Research → Capture → Enrich → Score → Position → Propose → (Revise) → Approve → Build

| Step | Input | Output | Where to verify |
|------|-------|--------|----------------|
| Research/Capture | Feed URL or manual entry | Lead + RESEARCH_SNAPSHOT | Leads list, lead detail |
| Enrich | Lead description + research | AI Enrichment Report | Lead detail artifacts |
| Score | Enrichment data | scoredAt timestamp | Lead detail |
| Position | Enrichment + score | POSITIONING_BRIEF | Lead detail artifacts |
| Propose | Positioning + enrichment + ROI | Proposal artifact | Lead detail, Proposals list |
| Revise | Instruction + prior proposal | New proposal artifact | Lead detail |
| Approve | Proposal exists | status = APPROVED | Lead detail status |
| Build | APPROVED + proposal + no project | Project created | Lead detail |

**Check on Metrics page:** Every step should show in the pipeline run with timings, success/fail, and a RUN_REPORT artifact.

---

## 11) Pass criteria (nothing missed)

- [ ] `/api/health` is green (all checks true).
- [ ] Login works; no loops; sessions persist.
- [ ] Creating a lead auto-runs pipeline and produces all artifacts (enrich, score, positioning, proposal).
- [ ] Re-running pipeline is idempotent (no duplicate artifacts).
- [ ] Proposal revise creates a new proposal artifact; positioning unchanged.
- [ ] Approve requires proposal.
- [ ] Build requires APPROVED + proposal artifact + no existing project.
- [ ] Build cannot run twice (second attempt blocked).
- [ ] PATCH cannot set status, approvedAt, build*, proposalSentAt, dealOutcome.
- [ ] Retry endpoint works; lock prevents double concurrent runs on same lead.
- [ ] Metrics reflect runs/steps; RUN_REPORT exists per run.
- [ ] Research snapshot influences proposal without hallucinations.
- [ ] (Optional) Email ingestion creates leads and triggers pipeline, if enabled.
- [ ] **Production:** Health, login, Command Center, one lead detail, Metrics — all render with live data (MCP browser or real browser).

---

## Optional: dry-run (no OpenAI)

```bash
PIPELINE_DRY_RUN=1 npm run dev
```

Pipeline creates placeholder artifacts; no `OPENAI_API_KEY` needed for create-lead → metrics flow.

---

*For testing strategy overview and checklists (Night operator, Before clients, After deploy, When app feels slow), see `docs/TESTING_SIDE_PANEL.md`. For route inventory, see `docs/AUDIT_AND_TEST_FLOWS.md`.*
