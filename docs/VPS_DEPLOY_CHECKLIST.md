# VPS Deploy Ready Checklist

**Deploy from your Mac:** `./scripts/deploy-remote.sh` (fast) or `./scripts/deploy-remote.sh --full` (with DB sync). No deploy key? Use `./scripts/sync-and-deploy.sh`. See [PROD_FIRST_WORKFLOW.md](PROD_FIRST_WORKFLOW.md). Quick runbook: [PROD_OPERATOR_LOOP.md](PROD_OPERATOR_LOOP.md).

## Required env vars (production)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth secret; generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full app URL e.g. `https://evenslouis.ca` |
| `ADMIN_EMAIL` | For login | Used by seed/reset-auth to create the single admin user (default `admin@evenslouis.ca`) |
| `ADMIN_PASSWORD` | For login | Used by seed/reset-auth; use the same value when you run reset-auth and when you log in (default `changeme`) |
| `OPENAI_API_KEY` | For pipeline | Omit or use dry-run for no LLM calls |
| `IMAP_HOST` | For email ingestion (worker) | e.g. `imap.hostinger.com` |
| `IMAP_PORT` | Optional | Default `993` (SSL) |
| `IMAP_USER` | For email ingestion | Full mailbox address |
| `IMAP_PASS` | For email ingestion | Mailbox password |
| `RESEARCH_CRON_SECRET` | If using research cron | Bearer token for `POST /api/research/run` |
| `RESEARCH_ENABLED` | Optional | `1` or `true` to enable research engine |
| `RESEARCH_LIMIT_PER_RUN` | Optional | Max leads per run (default 10, max 50) |
| `NOTIFY_EMAIL` | For website form | Where to receive lead notifications (default `contact@evenslouis.ca`) |
| `RESEND_API_KEY` | Optional | Resend API key; if set, form notifications sent via Resend |
| `SMTP_HOST` | Optional | SMTP server for form notifications (e.g. `smtp.hostinger.com`). Use with `SMTP_USER`/`SMTP_PASS` (or same as `IMAP_*`). |
| `SMTP_PORT` | Optional | Default `465` (SSL) |
| `SMTP_USER` | Optional | SMTP auth; can reuse `IMAP_USER` for same mailbox |
| `SMTP_PASS` | Optional | SMTP auth; can reuse `IMAP_PASS` |
| `NOTIFY_WEBHOOK_URL` | Optional | Webhook URL for pipeline/proposal notifications (Discord-compatible; also `DISCORD_WEBHOOK_URL`) |
| `APP_URL` | Optional | Base URL for webhook links if `NEXT_PUBLIC_APP_URL` unset; fallback `https://evenslouis.ca` |
| `REDIS_URL` | For worker/queues | Prod Docker: `redis://redis:6379`. Dev: `redis://localhost:6379` or omit. |
| `META_ACCESS_TOKEN` | Optional | For Meta Ads Monitor (`/dashboard/meta-ads`); long-lived or system user token with `ads_read`; add `ads_management` for pause/resume (V2) |
| `META_AD_ACCOUNT_ID` | Optional | Ad account ID (e.g. `act_1234567890`). See [META_ADS_MONITOR_SETUP.md](META_ADS_MONITOR_SETUP.md) |
| `META_APP_ID` | Optional | For Asset Health permission check via debug_token |
| `META_APP_SECRET` | Optional | For Asset Health permission check via debug_token |

**Admin login:** Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` on the server's `.env` to the same values you use to log in. Deploy runs `seed.mjs`, which creates/updates that user; if they differ, you can get a second user or lose access after a reset-auth.

**Prod e2e login:** To let Playwright log in at `https://evenslouis.ca`, add to the server's `.env`: `E2E_ALLOW_DEV_PASSWORD=1`, `E2E_EMAIL=your@email.com`, `AUTH_DEV_PASSWORD=same-as-E2E_PASSWORD`. Restart the app (or re-run deploy). The app will allow that email + password and create the user if missing.

**Email ingestion (worker):** If using Hostinger email, ensure IMAP is enabled for the mailbox and app/password settings match provider requirements. Restart the worker after changing any `IMAP_*` env vars.

**Website form notification:** Set `NOTIFY_EMAIL` and either `RESEND_API_KEY` or `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` (Hostinger: `smtp.hostinger.com`, port 465). You can reuse `IMAP_USER`/`IMAP_PASS` for SMTP if using the same mailbox.

## Pre-deploy checks (before deploying)

1. **Build and lint pass locally:**
   ```bash
   npm run build
   npm run lint
   ```
   Both must exit 0. Do not deploy if either fails.

2. **Automated tests pass:**
   ```bash
   USE_EXISTING_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
   ```

3. **Prisma schema valid:**
   ```bash
   npx prisma validate
   ```

4. **No money-path logic changes without review:** If the deploy touches pipeline gates, auth, or PATCH allowlists, review manually before proceeding.

## Deploy steps

1. **DB**
   ```bash
   npx prisma db push
   ```

2. **Build**
   ```bash
   npm run build
   ```

3. **Start**
   ```bash
   npm run start
   ```
   Or use your process manager (systemd, Docker, etc.).

## After-deploy smoke checklist

Run immediately after every production deploy. Do not skip.

### Automated (fast, 30 seconds)

```bash
# Curl-based smoke test
./scripts/smoke-test.sh https://evenslouis.ca

# Health only
curl -s https://evenslouis.ca/api/health
```

Both must pass. If health check fails, **rollback immediately** (see below).

### Manual production checks (MCP browser or real browser, 3-5 min)

- [ ] **Login:** Open `https://evenslouis.ca/login`, log in → dashboard loads
- [ ] **Command Center:** Scorecard renders, Failures card renders, data is current
- [ ] **One lead detail:** Open any lead → artifacts load, pipeline actions visible
- [ ] **Proposals:** List loads, at least one proposal visible (if any exist)
- [ ] **Metrics:** Page loads, recent runs visible
- [ ] **API auth gate:** `curl -s https://evenslouis.ca/api/leads` → 401 (confirms auth is working)
- [ ] **SSL:** Certificate valid (smoke-test.sh checks this for HTTPS)

If any check fails after deploy, rollback first, investigate second. See `docs/DEPLOY_SSH_SETUP.md` for rollback commands.

## Health check

- **Endpoint:** `GET /api/health`
- **Expected 200 when healthy:** `{ "ok": true, "checks": { "db": { "ok": true }, "pipelineTables": { "ok": true }, "authSecret": { "ok": true }, "nextAuthUrl": { "ok": true } } }`
- **503 when unhealthy:** `ok: false` and one or more checks failed.

## Rollback / no-deploy safety

**When to rollback:**
- Health check returns 503 or does not respond
- Login fails (redirect loop, credentials not working)
- Dashboard shows blank pages or 500 errors
- Any money-path gate is broken (build without approval, PATCH bypass)

**How to rollback (on the VPS):**
```bash
cd /root/client-engine
git log --oneline -5
git reset --hard HEAD~1
bash deploy.sh
curl -fsS https://evenslouis.ca/api/health
```

Or use the rollback script (see `docs/DEPLOY_SSH_SETUP.md`):
```bash
ssh root@69.62.66.78 '/root/rollback-client-engine.sh'
```

**When NOT to deploy:**
- Build or lint fails locally
- Automated tests fail
- Money-path logic was changed without review
- You're about to show the app to a client (deploy after, not before)
- Late at night when you can't monitor the result

## Research cron (optional)

If `RESEARCH_ENABLED=1` and you use a cron to run research:

```bash
# Example: every 6 hours
0 */6 * * * curl -s -X POST -H "Authorization: Bearer $RESEARCH_CRON_SECRET" "https://evenslouis.ca/api/research/run?limit=10"
```

Or from your host:

```bash
RESEARCH_CRON_SECRET=your-secret npm run research:run
```

## Reset production auth (login not working)

If email/password don't work at the production URL (e.g. evenslouis.ca), the production DB may have no user or a different password. Do this **on the VPS**, in the project directory, with the same env the app uses (e.g. same `.env` or env file):

1. **Confirm env:** Ensure `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set (same values you want to use to log in). If you use a `.env` file, `reset-auth` will load it when run in that directory.
2. **Recreate the single admin user:**
   ```bash
   npm run reset-auth
   ```
   This deletes all users and creates one admin with current `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or defaults `admin@evenslouis.ca` / `changeme`).
3. **Log in** at `/login` with that exact email and password.
4. **If you still get redirects or odd behavior:** Check `NEXTAUTH_URL` (e.g. `https://evenslouis.ca`) and that `AUTH_SECRET` is set.

## Disk space maintenance (avoid ENOSPC)

The VPS can fill up from Docker images, build cache, and container logs. We mitigate this long-term:

- **Deploy self-heal:** `deploy.sh` checks free space before building. If under 2GB free, it runs `docker system prune -a -f` and `docker builder prune -a -f`, then re-checks. If still low, it exits with a clear message.
- **Log rotation:** `docker-compose.yml` sets `max-size: 10m`, `max-file: 3` for all services so container logs stay bounded (~30MB per container).
- **One-command cleanup from your Mac:** If the server is out of disk (e.g. rsync or deploy fails with "No space left on device"), run:
  ```bash
  ./scripts/run-vps-cleanup.sh
  ```
  This SSHs to the VPS, prunes Docker and truncates container logs, then you can run `./scripts/sync-and-deploy.sh` again.
- **On the server:** Inspect usage with `df -h` and `docker system df`. Manual prune: `docker system prune -a -f` and `docker builder prune -a -f`. Optional: run `bash scripts/vps-disk-cleanup.sh` from the repo directory.
- **Optional (recurring):** On the VPS, a monthly cron to prune build cache can help: `0 0 1 * * docker builder prune -f` (runs once per month).

## Logs and failures

- **Next.js:** stdout/stderr of `npm run start` (or your process manager logs).
- **Pipeline failures:** Check `PipelineRun.error`, `PipelineStepRun.notes` (error code prefix), and RUN_REPORT.md artifacts per lead.
- **Auth redirect loops:** Ensure `NEXTAUTH_URL` matches the exact URL users hit and `AUTH_SECRET` is set.

---

*For full testing strategy, see `docs/TESTING_SIDE_PANEL.md`. For step-by-step E2E test runbook, see `docs/RUNBOOK.md`. Operator checklists: [NIGHT_OPERATOR_CHECKLIST.md](NIGHT_OPERATOR_CHECKLIST.md), [BEFORE_CLIENTS_CHECKLIST.md](BEFORE_CLIENTS_CHECKLIST.md), [AFTER_DEPLOY_SMOKE_CHECKLIST.md](AFTER_DEPLOY_SMOKE_CHECKLIST.md), [WHEN_APP_FEELS_SLOW_CHECKLIST.md](WHEN_APP_FEELS_SLOW_CHECKLIST.md).*
