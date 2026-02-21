# Client Engine

Private autopilot business system running on your VPS.

## Quick start (VPS)

```bash
# Clone and configure
git clone <repo-url> /root/client-engine
cd /root/client-engine
cp .env.example .env
# Edit .env with real values

# Deploy
bash deploy.sh
```

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
