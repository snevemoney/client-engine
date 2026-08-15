# Release Discipline — Client Engine

How we ship code to production. One page, no ambiguity.

---

## Release Flow

```
local dev → pre-deploy checks → push to main → deploy to VPS → smoke test → monitor
```

### 1. Pre-Deploy Checks (automated)

```bash
./scripts/pre-deploy.sh
```

Runs: lint, tsc, prisma validate, build, unit tests. Must exit 0.

### 2. Database Migrations

| Environment | Command | When |
|-------------|---------|------|
| Local dev | `npx prisma db push` | Quick schema sync during dev |
| Local dev | `npx prisma migrate dev --name <name>` | Creating migration files for production |
| Production | `npx prisma migrate deploy` | Applying committed migrations on deploy |

**Rule:** Never run `db push` in production. `deploy.sh` runs `migrate deploy`.

### 3. Deploy

```bash
# From your Mac (fast deploy)
./scripts/deploy-remote.sh

# Full deploy with DB sync
./scripts/deploy-remote.sh --full

# No deploy key setup
./scripts/sync-and-deploy.sh
```

What `deploy.sh` does on the server:
1. Disk space check (prunes Docker if <2GB free)
2. `git pull`
3. `npm install --production`
4. `npx prisma migrate deploy`
5. `npm run build`
6. Restart services via Docker Compose

### 4. Smoke Test (immediately after)

```bash
./scripts/smoke-test.sh https://evenslouis.ca
curl -s https://evenslouis.ca/api/health
```

Must both pass. If not → rollback.

### 5. Manual Checks (3-5 min)

- Login works
- Command center renders
- Lead detail loads
- API auth gate returns 401 without credentials

---

## Env Var Truth

### Required (app breaks without these)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `AUTH_SECRET` | NextAuth session encryption |
| `NEXTAUTH_URL` | Canonical URL (prevents redirect loops) |
| `ANTHROPIC_API_KEY` | Brain, agents, pipeline (Claude) |

### Required for Features

| Variable | Feature |
|----------|---------|
| `AGENT_CRON_SECRET` | Cron jobs, health checks |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Login, seed |
| `REDIS_URL` | Worker queues |
| `IMAP_HOST` / `IMAP_USER` / `IMAP_PASS` | Email ingestion |

### Optional

| Variable | Feature |
|----------|---------|
| `OPENAI_API_KEY` | Pipeline fallback LLM |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth |
| `RESEND_API_KEY` | Email notifications via Resend |
| `SMTP_HOST` / `USER` / `PASS` | Email notifications via SMTP |
| `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` | Meta Ads Monitor |
| `TRANSCRIPTAPI_API_KEY` | YouTube transcript fetch |

**Canonical source:** `.env.example` (always up to date).

---

## When NOT to Deploy

- Build or lint fails
- Tests fail
- Money-path logic changed without review
- About to demo to a client
- Late at night when you can't monitor

---

## Rollback

```bash
# On VPS
cd /root/client-engine
git log --oneline -5
git reset --hard HEAD~1
bash deploy.sh
curl -fsS https://evenslouis.ca/api/health

# Or from Mac
ssh $DEPLOY_SERVER '/root/rollback-client-engine.sh'
```

---

## References

- [VPS_DEPLOY_CHECKLIST.md](VPS_DEPLOY_CHECKLIST.md) — Full env var table + production setup
- [docs/DEPLOY_SSH_SETUP.md](DEPLOY_SSH_SETUP.md) — SSH key setup + rollback scripts
- [docs/RUNBOOK.md](RUNBOOK.md) — E2E test guide
- [docs/API_CONTRACTS.md](API_CONTRACTS.md) — Response shape standards
