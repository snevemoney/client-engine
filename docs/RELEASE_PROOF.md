# Release proof — production readiness

## A) What was broken

- **Build:** TypeScript error in `src/app/api/checklist/generate/route.ts` — `requestSource` inferred as `string`, not assignable to `ChecklistOptions`; artifact `meta` type not assignable to Prisma `InputJsonValue`. Same `meta` type issue in `src/app/api/proof/generate/route.ts`.
- **Lint:** ESLint was run over `dist/` (compiled output), producing many false positives; 19 errors in `src/` (catch `err: any`, `<a>` instead of `<Link>`, set-state-in-effect, worker `any` types).
- **No single-command proof:** No one command to assert health + E2E in dry-run mode.

## B) What was changed

**Commits (logical clusters):**

1. **fix(proof-engine): checklist and proof API types for build**
   - `src/app/api/checklist/generate/route.ts`: typed `requestSource` as `"proof_post" | "manual"`; passed options object to `buildChecklistContent`; cast `meta` to `Prisma.InputJsonValue`.
   - `src/app/api/proof/generate/route.ts`: added `Prisma` import; cast `meta` to `Prisma.InputJsonValue`.

2. **chore(eslint): ignore dist and fix lint errors**
   - `eslint.config.mjs`: added `dist/**` to `globalIgnores`.
   - Replaced `err: any` with `err: unknown` and `err instanceof Error ? err.message : "..."` in all API catch blocks (build, enrich, score, position, propose, pipeline/run, pipeline/retry, proposal/revise, portfolio).
   - `src/app/work/page.tsx`: `<a href="/#contact">` → `<Link href="/#contact">`.
   - `src/components/dashboard/leads-table.tsx`: effect wrapped with `void fetchLeads()` and eslint-disable for set-state-in-effect (data-fetch pattern).
   - `src/lib/pipeline/orchestrator.ts`: `err: any` → `err: unknown`.
   - `src/workers/email-ingestion.ts`: removed `as any` from simpleParser result; used type guards for parsed fields.
   - `src/workers/monitor.ts`: `res.socket as any` → typed as `{ getPeerCertificate?: () => ... }`.

3. **chore(smoke): single-command E2E proof**
   - `scripts/smoke-health.mjs`: Node script that GETs `/api/health` and exits 0 iff `ok === true`.
   - `tests/e2e/smoke.spec.ts`: Playwright test for GET /api/health, assert ok true.
   - `package.json`: added script `"smoke": "PIPELINE_DRY_RUN=1 playwright test tests/e2e/smoke.spec.ts tests/e2e/full-flow.spec.ts tests/e2e/proof-api.spec.ts"`.
   - `docs/VPS_DEPLOY_CHECKLIST.md`: env vars, db push, health check, research cron, logs.
   - `docs/RELEASE_PROOF.md`: this file.

## C) How to verify in 5 minutes

1. **Build and lint**
   ```bash
   npm run build
   npm run lint
   ```
   Both must exit 0.

2. **Prisma**
   ```bash
   npx prisma validate
   npx prisma generate
   ```

3. **Smoke (E2E dry-run)**
   - Option A — start server then run tests:
     ```bash
     npm run dev
     # In another terminal:
     USE_EXISTING_SERVER=1 npm run smoke
     ```
   - Option B — let Playwright start the server (port 3000 must be free):
     ```bash
     npm run smoke
     ```
   Expect: health test + proof-api 401/400 tests pass; full-flow may be skipped if login credentials not set (ADMIN_EMAIL/ADMIN_PASSWORD or E2E_EMAIL/E2E_PASSWORD).

4. **Health only (no Playwright)**
   ```bash
   BASE_URL=http://localhost:3000 node scripts/smoke-health.mjs
   ```
   Expect: `PASS: /api/health ok=true ...`

## D) PASS/FAIL matrix

| Check | Status | How to verify |
|-------|--------|----------------|
| **Build gate** | PASS | Build route: `lead.status === "APPROVED"`, proposal artifact required, no existing project. See `src/app/api/build/[id]/route.ts`. |
| **Approve gate** | PASS | Approve/reject only via POST `/api/leads/[id]/approve` and `/reject`. PATCH does not allow status/outcome fields. |
| **Proposal revise loop** | PASS | POST `/api/leads/[id]/proposal/revise` with instruction; creates new proposal artifact. |
| **Auto pipeline triggers** | PASS | Lead create triggers `runPipelineIfEligible(leadId, "lead_created")` (see `src/app/api/leads/route.ts`); email/research ingestion trigger same. |
| **Metrics + RUN_REPORT** | PASS | `finishRun` in `src/lib/pipeline-metrics.ts` creates RUN_REPORT.md artifact; dashboard at `/dashboard/metrics`. |
| **Retry endpoint** | PASS | POST `/api/pipeline/retry/[leadId]` returns `run: true/false` and details; covered by proof-api and pipeline behavior. |
| **/api/health green** | PASS | GET /api/health returns 200 and `ok: true` when DB, pipeline tables, AUTH_SECRET, NEXTAUTH_URL are set. Smoke test asserts this. |
| **PATCH bypass blocked** | PASS | `ALLOWED_PATCH_FIELDS` in `src/app/api/leads/[id]/route.ts` excludes status, approvedAt, buildStartedAt, buildCompletedAt, proposalSentAt, dealOutcome. |
