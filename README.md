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
bash deploy.sh          # Pull, build, migrate, restart
bash backup.sh          # Backup Postgres to ./backups/
bash logs.sh            # Tail app logs
bash logs.sh worker     # Tail worker logs
bash logs.sh postgres   # Tail DB logs
```

## URLs

- **https://evenslouis.ca** — Public site
- **https://evenslouis.ca/dashboard** — Private dashboard (login required)
- **https://evenslouis.pro** — Redirects to dashboard

## Local development

```bash
npm install
cp .env.example .env   # Set AUTH_SECRET, DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma db push
npx prisma db seed
npm run dev
```

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

## Deploy from local machine

```bash
ssh root@69.62.66.78 "cd /root/client-engine && bash deploy.sh"
```
