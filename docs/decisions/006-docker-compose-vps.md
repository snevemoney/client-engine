# ADR-006: Docker Compose on VPS (Not Vercel/Railway)

## Status: Accepted

## Context
Deployment options for a Next.js app with workers, Postgres, and Redis:
1. **Vercel** — Managed Next.js hosting. No persistent workers, no Redis, database add-ons cost extra.
2. **Railway/Render** — Managed containers. Good DX, but $20+/mo per service, costs scale fast.
3. **Docker Compose on VPS** — Full control, fixed cost, all services co-located.

## Decision
Deploy via Docker Compose on a Hostinger VPS with Caddy as reverse proxy.

**Architecture:**
- 5 Docker services: app, worker, postgres, redis, builder
- Caddy handles HTTPS termination and routing
- Fixed monthly cost regardless of traffic
- Full control over infrastructure

**Reasons:**
- **Cost:** VPS is $10-20/mo fixed vs $50-100+/mo for managed services at this scale.
- **Workers:** Need persistent background processes (email ingestion, BullMQ, monitoring). Vercel serverless can't do this.
- **Redis:** Co-located Redis with zero latency. No external service needed.
- **Data sovereignty:** Database on same machine, no third-party data handling.
- **Builder service:** Need a custom service on port 3001 that Vercel can't host.

## Consequences
- Must manage own infrastructure (updates, backups, monitoring).
- Deploy scripts instead of git-push deploys.
- No auto-scaling (fixed VPS resources). Acceptable for single-operator system.
- SSL via Caddy auto-renewal (zero maintenance).
- Must handle own backups (`backup.sh` script exists).
