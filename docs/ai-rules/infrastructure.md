# Infrastructure — AI Rules

Complete infrastructure reference for development, production, networking, domains, and VPS.

## Environments

### Development (Local)

| Component | URL / Config |
|-----------|-------------|
| Next.js app | `http://localhost:3000` |
| PostgreSQL | `localhost:5432` (or Docker) |
| Redis | `localhost:6379` (optional) |
| Builder service | `http://localhost:3001` (optional) |

**Start dev:**
```bash
npm run dev              # Next.js dev server
npm run worker           # Background workers (separate terminal)
```

**Database:**
```bash
npx prisma db push       # Sync schema
npx prisma studio        # GUI browser
npm run db:seed           # Seed admin + sample data
```

**Auth bypass:** Set `AUTH_DEV_PASSWORD` in `.env` — any email + that password logs in.

### Production (VPS)

| Component | URL / Config |
|-----------|-------------|
| Public URL | `https://evenslouis.ca` |
| App (Docker) | `127.0.0.1:3200` → container port 3000 |
| Builder (Docker) | `127.0.0.1:3001` → container port 3001 |
| PostgreSQL | Docker internal network (`postgres:5432`) |
| Redis | Docker internal network (`redis:6379`) |
| Reverse proxy | Caddy (auto HTTPS) |

---

## Docker Compose Architecture

```yaml
services:
  app:        # Next.js standalone, port 3200→3000
  worker:     # Background workers (email, monitor, BullMQ)
  postgres:   # PostgreSQL 16 Alpine, persistent volume
  redis:      # Redis 7 Alpine, persistent volume
  builder:    # Website builder service, port 3001→3001
```

**Network:** All services on default Docker bridge network. Services reference each other by name (`postgres`, `redis`).

**Volumes:**
- `pgdata` — PostgreSQL data (persistent)
- `redisdata` — Redis data (persistent)

**Health checks:**
- postgres: `pg_isready -U postgres`
- redis: `redis-cli ping`

---

## VPS Details

| Property | Value |
|----------|-------|
| Provider | Hostinger |
| OS | Ubuntu |
| Access | SSH |
| Reverse proxy | Caddy (auto-HTTPS via Let's Encrypt) |
| Firewall | UFW (ports 22, 80, 443) |

**SSH access:**
```bash
ssh user@evenslouis.ca
```

**Service management:**
```bash
docker compose up -d           # Start all services
docker compose down            # Stop all services
docker compose logs -f app     # Follow app logs
docker compose restart app     # Restart app only
```

**Disk management:**
```bash
./scripts/check-space.sh       # Check disk usage
./scripts/vps-disk-cleanup.sh  # Clean old images/caches
./scripts/run-vps-cleanup.sh   # Full cleanup routine
```

---

## Domains & DNS

| Domain | Purpose | Status |
|--------|---------|--------|
| `evenslouis.ca` | Main site + app | Active |
| `evenslouis.pro` | Available for future use | Reserved |

**DNS:** Pointed to Hostinger VPS IP. Caddy handles HTTPS certificates automatically.

**Subdomains (potential):**
- `app.evenslouis.ca` — Dashboard (if separated from public site)
- `api.evenslouis.ca` — API (currently same origin)
- `builder.evenslouis.ca` — Builder service (currently internal only)

---

## Networking

### External Access
```
Internet → Caddy (:443) → app container (:3000)
                        → (future: builder if public)
```

### Internal (Docker Network)
```
app ──→ postgres:5432
app ──→ redis:6379
app ──→ builder:3001
worker ──→ postgres:5432
worker ──→ redis:6379
```

### Ports

| Port | Service | External? |
|------|---------|-----------|
| 22 | SSH | Yes (UFW) |
| 80 | Caddy HTTP (→ HTTPS redirect) | Yes |
| 443 | Caddy HTTPS | Yes |
| 3000 | Next.js app (Docker internal) | No |
| 3001 | Builder service (Docker internal) | No |
| 3200 | App published port (host) | Localhost only |
| 5432 | PostgreSQL (Docker internal) | No |
| 6379 | Redis (Docker internal) | No |

### Security
- All services bound to `127.0.0.1` (not `0.0.0.0`) except Caddy
- PostgreSQL and Redis not exposed externally
- Caddy handles TLS termination
- Auth required on all API routes (except `/api/site/leads` and `/api/health`)
- Rate limiting on all write endpoints

---

## Deploy Process

### Quick Deploy
```bash
npm run deploy                 # scripts/deploy-remote.sh
```

### Safe Deploy (recommended)
```bash
npm run ops:deploy:safe        # scripts/deploy-safe.sh
```

### What deploy does:
1. SSH into VPS
2. `git pull` latest code
3. `docker compose build app worker`
4. `docker compose up -d`
5. Wait for health check (`/api/health`)
6. Run smoke test

### Post-Deploy Verification
```bash
npm run ops:health             # Check /api/health
./scripts/smoke-test.sh        # Full smoke test
```

### Rollback
```bash
./scripts/rollback-help.sh     # Shows rollback options
# Typically: git revert + redeploy
```

---

## Backup

```bash
./backup.sh                    # Runs pg_dump, stores in backups/
```

**What's backed up:**
- PostgreSQL full dump (compressed)
- Stored in `backups/` directory

**What's NOT backed up (managed by Docker volumes):**
- Redis data (ephemeral, acceptable loss)
- .next build cache (rebuilt on deploy)

---

## Monitoring

### Health Endpoint
```bash
curl https://evenslouis.ca/api/health
```
Returns: DB ping status, env vars present, service status.

### Logs
```bash
npm run ops:logs               # scripts/watch-prod.sh
docker compose logs -f app     # Direct Docker logs
docker compose logs -f worker  # Worker logs
```

### Observability (In-App)
- `/dashboard/observability` — OpsEvents, errors, slow routes
- `/dashboard/ops-health` — System health dashboard
- `/dashboard/jobs` — Job queue monitoring
- `/dashboard/system` — Execution metrics

### Slow Query Detection
The `db` singleton logs queries over 300ms:
```
[SLOW] area=db name=Lead.findMany ms=450
```

The `withRouteTiming()` wrapper logs routes over 500ms:
```
[SLOW] area=api name=GET /api/command-center ms=1200
```

---

## Environment Variable Groups

### Dev-Only
| Var | Purpose |
|-----|---------|
| `AUTH_DEV_PASSWORD` | Bypass login in development |
| `OAUTH_SIMULATION` | Show "Simulate Google" on login |
| `PIPELINE_DRY_RUN` | Placeholder artifacts (no API calls) |
| `LEARNING_USE_MOCK_TRANSCRIPT` | Mock YouTube transcripts |

### Production-Required
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/db` |
| `AUTH_SECRET` | JWT secret (openssl rand -base64 32) |
| `NEXTAUTH_URL` | `https://evenslouis.ca` |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `REDIS_URL` | `redis://redis:6379` |

### Production-Optional
| Var | Purpose |
|-----|---------|
| `GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth |
| `RESEND_API_KEY` | Email notifications |
| `AGENT_CRON_SECRET` | Agent cron auth |
| `META_ACCESS_TOKEN` | Meta Ads API |
| `IMAP_*` | Email ingestion |

---

## Cron Jobs

External cron (VPS crontab or external service) hits these endpoints:

| Endpoint | Schedule | Auth |
|----------|----------|------|
| `POST /api/agents/cron` | Per agent schedule | Bearer `AGENT_CRON_SECRET` |
| `POST /api/jobs/tick` | Every 1-5 minutes | Bearer or session |
| `POST /api/cadence/process` | Daily (e.g. 8am) | Bearer `AGENT_CRON_SECRET` or session |
| `POST /api/ops/workday-run` | Daily morning | Bearer `RESEARCH_CRON_SECRET` |
| `POST /api/meta-ads/scheduler/run-cron` | Per settings | `x-cron-key` header |
| `POST /api/notifications/run-escalations` | Every 15 minutes | Session |

### Example crontab entry:
```cron
*/5 * * * * curl -sf -X POST https://evenslouis.ca/api/jobs/tick -H "Authorization: Bearer $AGENT_CRON_SECRET"
0 8 * * * curl -sf -X POST https://evenslouis.ca/api/ops/workday-run -H "Authorization: Bearer $RESEARCH_CRON_SECRET"
0 8 * * * curl -sf -X POST https://evenslouis.ca/api/cadence/process -H "Authorization: Bearer $AGENT_CRON_SECRET"
```
