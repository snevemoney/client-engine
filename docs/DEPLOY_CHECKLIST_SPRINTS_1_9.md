# Deploy Checklist: Client Engine — Sprints 1–9

**Date:** 2026-03-04
**Stack:** Next.js / Prisma / PostgreSQL / BullMQ / Redis / OpenAI
**Scope:** 9 sprints — pipeline visibility, outreach, scope negotiation, payment tracking, client portal, cadence orchestrator, proof autopublish, campaigns, outcome ledger + scorecard

See also: [VPS_DEPLOY_CHECKLIST.md](VPS_DEPLOY_CHECKLIST.md) for env vars and pre-deploy automation.

---

## 0. Backup (do this first, no exceptions)

- [ ] **Snapshot production database** — `pg_dump` or your hosting provider's snapshot tool
- [ ] **Note the current git SHA on production** — you'll need this if you rollback
- [ ] **Confirm you can restore** — test that your backup is valid (check file size, try a dry-run restore to a scratch DB if paranoid)

---

## 1. Pre-Deploy Verification (local/CI)

### Code
- [ ] `npx tsc --noEmit` passes clean
- [ ] `npm run build` completes (all routes build)
- [ ] `npm test` passes (run `npx prisma db push` first if test DB schema is stale)
- [ ] API routes audit passes: `USE_EXISTING_SERVER=1 npx playwright test tests/e2e/api-routes-audit.spec.ts`
- [ ] No `.env` secrets committed — check `git diff --cached` for anything sensitive

### Migrations
- [ ] All migrations in `prisma/migrations/` are additive (no DROP, no RENAME)
- [ ] Review each migration SQL — confirm all are **additive** (ALTER TABLE ADD COLUMN, CREATE TABLE)
- [ ] No migration modifies existing column types or drops constraints
- [ ] Run `npx prisma migrate status` — verify no pending migrations or resolve before deploy

### Environment Variables
- [ ] `DATABASE_URL` — production PostgreSQL connection string
- [ ] `REDIS_URL` — production Redis for BullMQ
- [ ] `OPENAI_API_KEY` — required for proof generation, proposal drafting, enrichment
- [ ] `AUTH_SECRET` — auth signing (NextAuth)
- [ ] `NEXTAUTH_URL` — production URL
- [ ] Any email transport vars (`SMTP_*`, `RESEND_API_KEY`) for `sendOperatorAlert` and client notifications

---

## 2. Database Migration (deploy schema BEFORE code)

Deploy scripts run `prisma migrate deploy` automatically. If deploying manually:

- [ ] **Run migrations against production:**
  ```bash
  DATABASE_URL="<production_url>" npx prisma migrate deploy
  ```
- [ ] Verify migration output — should show each migration applied successfully
- [ ] **Run `prisma generate`** — confirms the Prisma client matches the new schema
- [ ] Spot-check: connect to production DB and verify:
  - [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'Project' AND column_name = 'paymentStatus';` returns a row
  - [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'Project' AND column_name = 'proofPublishedAt';` returns a row
  - [ ] `SELECT * FROM "Campaign" LIMIT 1;` runs without error (table exists, even if empty)
  - [ ] `SELECT * FROM "Outcome" LIMIT 1;` runs without error
  - [ ] `SELECT * FROM "Cadence" LIMIT 1;` runs without error

**Why schema first:** All migrations are additive. Existing code ignores new columns. New code needs them. Deploying schema first means there's no window where code expects columns that don't exist.

---

## 3. Deploy Application Code

- [ ] **Deploy to staging first** (if you have one)
- [ ] **Deploy to production** — use `./scripts/deploy-safe.sh` (VPS) or your platform's deploy
- [ ] Confirm `prisma generate` runs during your build step
- [ ] If using Docker: `docker compose build app worker` then `docker compose up -d`

---

## 4. Restart Workers

- [ ] **Restart BullMQ workers** — they need the new code for:
  - Cadence processing (`processDueCadences`)
  - Proof generation (`generateProofDraft` on payment transition)
  - Any new queue job types from Sprints 5–9
- [ ] **Restart cron jobs** — cadence due processing runs on a cron schedule
- [ ] Verify workers connect to Redis successfully (check logs for connection errors)

---

## 5. Smoke Test Production (do these manually)

### Critical path — must all work
- [ ] **Login** — dashboard loads, no blank screens
- [ ] **Sidebar** — shows all 6 groups: Capture, Convert, Build, Prove, Optimize, System
- [ ] **Create a lead** — fill form, submit, verify it appears in pipeline
- [ ] **Pipeline view** — leads visible with correct status badges
- [ ] **Lead detail** — click a lead, verify enrichment/score/proposal artifacts display

### Sprint 4 — Scope negotiation
- [ ] Lead status dropdown includes `SCOPE_SENT` and `SCOPE_APPROVED`

### Sprint 5 — Payment tracking
- [ ] **Deploys page** — filter tabs visible (All / Unpaid / Invoiced / Paid)
- [ ] Click a payment badge — inline editor appears
- [ ] **Command Center** — A/R panel shows metrics (even if all zeros)

### Sprint 6 — Client portal
- [ ] Navigate to a deployed project → "Share Portal" button exists
- [ ] Copy portal link → open in incognito → portal page loads (or 404 if no token yet)

### Sprint 7 — Cadence
- [ ] **Command Center** — Cadence Due card visible (may show "No cadences due")
- [ ] On lead detail: Cadences section visible

### Sprint 8 — Proof & Campaigns
- [ ] **Deploys page** — "Proof" button visible on deployed projects
- [ ] Click Proof → editor expands (headline, summary, tags fields)
- [ ] **Campaigns page** — accessible from sidebar, create form works
- [ ] `/proof/nonexistent-slug` returns 404 (not 500)
- [ ] `/campaigns/nonexistent-slug` returns 404 (not 500)

### Sprint 9 — Outcome & Scorecard
- [ ] **Deploys page** — Outcome editor visible for paid projects
- [ ] **Scorecard page** — accessible from sidebar, sections render (even with no data)

---

## 6. Monitor (first 30 minutes)

- [ ] **Error logs** — watch for 500s, unhandled rejections, Prisma connection errors
- [ ] **Worker logs** — watch for BullMQ job failures, Redis disconnects
- [ ] **Response times** — dashboard and API routes load in normal time
- [ ] **OpenAI calls** — verify proof generation and proposal drafting don't throw (check for API key issues, rate limits)
- [ ] **Email/webhook transport** — if you have `sendOperatorAlert` configured, trigger a test notification

---

## 7. Rollback Plan

**Trigger rollback if:**
- Dashboard doesn't load (blank screen, 500)
- Lead creation fails
- Payment status transitions throw errors
- Workers crash-loop

**How to rollback:**

1. **Redeploy previous code:**
   ```bash
   git checkout <previous-sha>
   # redeploy via your platform (e.g. ./scripts/deploy-safe.sh)
   ```

2. **Database:** The migrations are all additive (new columns, new tables). Old code simply ignores them. **You do NOT need to rollback the database** — the old code will work fine with the extra columns sitting there.

3. **Workers:** Restart workers on the old code. Old workers don't know about new job types, which is fine — new jobs just won't process until you re-deploy.

**This is the key insight:** because every migration is additive and no existing columns were modified, code rollback is safe without database rollback. This is the lowest-risk scenario.

---

## 8. Post-Deploy

- [ ] **Verify CHANGELOG.md** is up to date
- [ ] **Tag the release** — `git tag v1.x.0 && git push --tags`
- [ ] **Close any tracking issues/tickets** for Sprints 1–9
- [ ] **Notify stakeholders** — "Deploy complete, 9 sprints shipped"
- [ ] **Schedule:** revisit failing E2E tests (trust-to-close, coach 5.2/5.3, networking event) when next working on those features

---

## Quick Reference: Migration Order

| Order | Migration | What it does | Risk |
|-------|-----------|-------------|------|
| 1 | `20260222_score_engine_foundation` | Score engine foundation | Low |
| 2 | `20260222_youtube_ingest_pipeline` | YouTube ingest | Low |
| 3 | `20260226_next_action_execution_delivery` | NBA execution | Low |
| 4 | `20260227_next_action_preference_personalization` | NBA preferences | Low |
| 5 | `20260228_next_action_template_key` | NBA template key | Low |
| 6 | `20260229_copilot_sessions` | Copilot sessions | Low |
| 7 | `20260301_add_founder_os_models` | Founder OS models | Low |
| 8 | `20260302_add_operator_memory` | Operator memory | Low |
| 9 | `20260303_add_operator_attribution` | Operator attribution | Low |
| 10 | `20260304_growth_engine_v1` | Growth engine | Low |
| 11 | `20260305_growth_execution_layer` | Growth execution | Low |
| 12 | `20260306_website_builder_integration` | Website builder | Low |

All migrations add columns or tables. None drop or rename. Old code ignores new columns. **Database rollback is not needed if code rollback is triggered.**
