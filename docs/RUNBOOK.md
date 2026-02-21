# Runbook: Full E2E test (production-grade audit)

Do this in Cursor in **this order**. Use the side-panel browser for UI steps; use terminal for API/scripts.

---

## 1) Preflight (env + server + health)

**Terminal:**

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
4. **Side-panel browser:** open **/api/health**
   - Must return **200** with `ok: true` and all checks true (db, pipelineTables, authSecret, nextAuthUrl).

**Fail conditions to catch here:**

- Redirect loop on /login → fix NEXTAUTH_URL / AUTH_SECRET.
- Missing AUTH_SECRET / NEXTAUTH_URL → health or login will fail.
- DB not reachable or pipeline tables missing → health checks false; run `prisma db push`.

---

## 2) Auth + RBAC (login + protected routes)

**Side-panel browser:**

1. Go to **/login** and sign in with admin creds (or dev bypass: any email + `AUTH_DEV_PASSWORD`).
2. Confirm **/dashboard** loads; no redirect loop; session persists after refresh.
3. (Optional) In a private window or after sign-out, hit a protected pipeline endpoint → must get **401**.

**Fail conditions:**

- Credentials not working → run `npm run reset-auth`, check ADMIN_EMAIL/ADMIN_PASSWORD.
- Middleware blocking /api/auth/* or session user missing on protected endpoints → fix auth config.

---

## 3) Core pipeline E2E (manual lead → auto pipeline → artifacts)

**Side-panel browser:**

1. Create a lead from **New Lead** (e.g. title “E2E Lead 001”, description “Need automation for booking + invoicing”, contact email any).
2. Open that lead’s detail page (from dashboard or metrics).
3. Confirm artifacts appear (or after refresh):
   - enrichment (AI Enrichment Report)
   - score (lead.scoredAt set)
   - positioning brief (POSITIONING_BRIEF)
   - proposal
4. Open **/dashboard/metrics** and confirm:
   - A new run exists for that lead.
   - Step timings populated (enrich → score → position → propose).
   - RUN_REPORT.md artifact exists for that run (in lead artifacts or run report list).

**Fail conditions:**

- Pipeline doesn’t trigger on lead creation → check POST /api/leads fires `runPipelineIfEligible(leadId, "lead_created")`.
- Steps run but don’t write artifacts → check step success + artifact create in orchestrator.
- Step failure doesn’t record notes/error codes → check error classifier + finishStep(notes).
- Metrics page errors → check PipelineRun/PipelineStepRun exist and query.

---

## 4) Idempotency + locks (double-run attempts)

1. **Idempotency:** On the same lead, hit “Run pipeline” / “Retry pipeline” again.
   - **Expected:** Steps that already have artifacts are **skipped**; no duplicate enrichment/score/positioning/proposal (unless you explicitly revised).
2. **Concurrency:** Trigger pipeline twice quickly on the **same** lead (e.g. two retry requests back-to-back).
   - **Expected:** One run proceeds; the other gets `run: false, reason: "locked"` (or equivalent). No duplicate artifacts.

**Pass criteria:**

- No duplicate artifacts.
- Runs show skipped steps or clear no-op behavior.

---

## 5) Gate tests (money-path locks are real)

**Build gate:**

1. On a lead that is **not** approved: try **Build** → must return **403** (and message about APPROVED).
2. Approve the lead; then (if you can simulate) ensure **no** proposal artifact for that lead and try Build → must return **403** (“No proposal artifact” or equivalent).

**Approve gate:**

- Approve should require at least one proposal artifact (API returns 400 if none).

**PATCH bypass test (terminal):**

```bash
curl -s -X PATCH "http://localhost:3000/api/leads/LEAD_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED","approvedAt":"2020-01-01T00:00:00.000Z"}'
```

- **Expected:** **400** and message that field(s) cannot be updated via PATCH.

**Critical fail condition:**

- Anything that lets you build without **APPROVED** + **proposal artifact** is a security hole.

---

## 6) Revise loop (proposal iteration)

**Side-panel browser:**

1. On lead detail, use **Revise proposal** with an instruction (e.g. “Make it shorter, stronger hook, add 3 proof bullets, keep problem-first”).
2. Verify:
   - A **new** proposal artifact is created.
   - Positioning brief **remains the same**.
   - Proposal content reflects the instruction and does not invent facts not in lead/snapshot.

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

## 8) Worker paths (optional; for “while I’m at my 9–5”)

If you use email ingestion / background jobs:

1. Start Redis if required (or confirm worker isn’t needed for your flow).
2. Run worker: `npm run worker`.
3. Verify ingestion creates a lead, triggers pipeline, and creates artifacts (e.g. send a test email or trigger ingestion once).

---

## 9) Research snapshot → “why now” (R1 proof)

**Terminal:**

```bash
node scripts/create-research-lead.mjs
```

- Prints the new lead ID.

**Side-panel browser:**

1. Open **/dashboard/leads/LEAD_ID** (use printed id).
2. Trigger **Run pipeline** / **Retry pipeline** (or wait if auto-trigger on create is wired).
3. Confirm proposal uses “why now” from the RESEARCH_SNAPSHOT (e.g. urgency, tools mentioned) without inventing facts.

---

## 10) Pass criteria (nothing missed)

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

---

## Optional: dry-run (no OpenAI)

```bash
PIPELINE_DRY_RUN=1 npm run dev
```

Pipeline creates placeholder artifacts; no `OPENAI_API_KEY` needed for create-lead → metrics flow.
