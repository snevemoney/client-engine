# Client Engine

Private autopilot business system running on your VPS.

## Quick start (VPS)

```bash
# Clone and configure
git clone <repo-url> /root/client-engine
cd /root/client-engine
cp .env.example .env
# Edit .env with real values (see Production checklist below)

# Deploy
bash deploy.sh
```

## Production checklist (before live usage)

1. **Env (VPS or `.env`):** Must include:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `NEXTAUTH_URL` (e.g. `https://evenslouis.ca`)
   - `OPENAI_API_KEY`
2. **Database:** `deploy.sh` runs `prisma db push`. If you deploy without it, run `npx prisma db push` on the server once.
3. **Health:** After deploy, confirm `GET /api/health` returns **200** with `ok: true` and all checks true (db, pipelineTables, authSecret, nextAuthUrl).

## Operations

```bash
bash deploy.sh          # On server: build, migrate, restart
./scripts/sync-and-deploy.sh   # From Mac: push, rsync to server, deploy (keeps dev/prod in sync)
./scripts/deploy-remote.sh     # From Mac: git pull on server + deploy (requires deploy key)
bash backup.sh          # Backup Postgres to ./backups/
bash logs.sh            # Tail app logs
bash logs.sh worker     # Tail worker logs
bash logs.sh postgres   # Tail DB logs
```

**One-command deploy from your machine:** Use `./scripts/sync-and-deploy.sh` to keep dev and prod in sync (push, rsync, deploy). If the server has an SSH deploy key, you can use `./scripts/deploy-remote.sh` instead. See [docs/DEPLOY_SSH_SETUP.md](docs/DEPLOY_SSH_SETUP.md).

**Post-deploy smoke test:** `./scripts/smoke-test.sh` (or `./scripts/smoke-test.sh https://evenslouis.ca`) — checks homepage, login, dashboard, `/api/health`, `/api/ops/command`, SSL. Exit 0 = all pass.

**VPS out of disk (ENOSPC / rsync or deploy fails):** Run `./scripts/run-vps-cleanup.sh` from your Mac to prune Docker and free space on the server, then run `./scripts/sync-and-deploy.sh` again. See [docs/VPS_DEPLOY_CHECKLIST.md](docs/VPS_DEPLOY_CHECKLIST.md) § Disk space maintenance.

## URLs

- **https://evenslouis.ca** — Public site
- **https://evenslouis.ca/dashboard** — Private dashboard (login required)
- **https://evenslouis.pro** — Redirects to dashboard

## Local development

```bash
npm install
cp .env.example .env   # Set AUTH_SECRET, DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD; REDIS_URL=redis://localhost:6379 if using Redis locally
npx prisma db push
npx prisma db seed
npm run dev
```

Use the same `.env.example` as prod; only `DATABASE_URL` and `REDIS_URL` differ (localhost vs Docker service names).

**Run everything without interruptions:** If you changed `.env`, restart `npm run dev` once so the app loads the new values. Then you can log in at http://localhost:3000/login and run `npm run test:e2e:dry` for the full flow (login → dashboard → metrics → new lead → metrics).

**Full manual runbook (production-grade audit):** [docs/RUNBOOK.md](docs/RUNBOOK.md) — preflight, auth, pipeline E2E, idempotency, gates, revise, retry, worker (optional), research snapshot test; pass criteria and fail conditions.

**Next: R1 Research Engine:** [docs/NEXT_R1.md](docs/NEXT_R1.md) — 9–5 automation requirements, R1 components (Upwork API first), notifications, “10 real clients” definitions.

**Can't log in?**
1. Run `npm run reset-auth`, then try again with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
2. If it still fails, check the terminal where `npm run dev` is running — you'll see either "no user for email …" or "wrong password for …".
3. **Dev bypass:** In `.env` add `AUTH_DEV_PASSWORD=changeme`. Restart dev server. You can then log in with *any* email and password `changeme` (no DB check). Remove this in production.

## E2E tests (Playwright)

Runs: login → dashboard → metrics → new lead → metrics.

**Local:** Ensure `.env` has `AUTH_SECRET`, `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Then:

```bash
npm run test:e2e
```

To run without an OpenAI key (pipeline uses placeholder artifacts):

```bash
PIPELINE_DRY_RUN=1 npm run test:e2e
```

**Production:** Use `PLAYWRIGHT_BASE_URL=https://evenslouis.ca` only after fixing redirect loops (set `NEXTAUTH_URL` and `AUTH_SECRET` on the server).

**Testing strategy:** [docs/TESTING_SIDE_PANEL.md](docs/TESTING_SIDE_PANEL.md) — two-tier approach (Playwright automated + manual production checks), page-by-page test matrix, and embedded browser notes.

## Operator checklists

| When | Doc |
|------|-----|
| After your day job (10–15 min) | [docs/NIGHT_OPERATOR_CHECKLIST.md](docs/NIGHT_OPERATOR_CHECKLIST.md) |
| Before a client call or demo | [docs/BEFORE_CLIENTS_CHECKLIST.md](docs/BEFORE_CLIENTS_CHECKLIST.md) |
| After every production deploy | [docs/AFTER_DEPLOY_SMOKE_CHECKLIST.md](docs/AFTER_DEPLOY_SMOKE_CHECKLIST.md) |
| When the app feels slow | [docs/WHEN_APP_FEELS_SLOW_CHECKLIST.md](docs/WHEN_APP_FEELS_SLOW_CHECKLIST.md) |
| Weekly deep review | [docs/WEEKLY_PRODUCTION_CRITICISM_CHECKLIST.md](docs/WEEKLY_PRODUCTION_CRITICISM_CHECKLIST.md) |

Full testing strategy and route inventory: [docs/TESTING_SIDE_PANEL.md](docs/TESTING_SIDE_PANEL.md) and [docs/AUDIT_AND_TEST_FLOWS.md](docs/AUDIT_AND_TEST_FLOWS.md).

## Deploy from local machine (keep dev and prod in sync)

**Recommended:** Push your changes to `main`, then run:

```bash
./scripts/sync-and-deploy.sh
```

This pushes to GitHub, rsyncs code to the VPS, runs `deploy.sh` on the server, and checks health. Use this when the server does not have a GitHub deploy key.

**If the server has a deploy key** (see [docs/DEPLOY_SSH_SETUP.md](docs/DEPLOY_SSH_SETUP.md)):

```bash
./scripts/deploy-remote.sh
```

**Manual (no sync):** To only run deploy on the server without pushing or rsync:

```bash
ssh root@69.62.66.78 "cd /root/client-engine && bash deploy.sh"
```
