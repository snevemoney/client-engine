# VPS Deploy Ready Checklist

## Required env vars (production)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth secret; generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full app URL e.g. `https://evenslouis.ca` |
| `OPENAI_API_KEY` | For pipeline | Omit or use dry-run for no LLM calls |
| `RESEARCH_CRON_SECRET` | If using research cron | Bearer token for `POST /api/research/run` |
| `RESEARCH_ENABLED` | Optional | `1` or `true` to enable research engine |
| `RESEARCH_LIMIT_PER_RUN` | Optional | Max leads per run (default 10, max 50) |

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

## Health check

- **Endpoint:** `GET /api/health`
- **Expected 200 when healthy:** `{ "ok": true, "checks": { "db": { "ok": true }, "pipelineTables": { "ok": true }, "authSecret": { "ok": true }, "nextAuthUrl": { "ok": true } } }`
- **503 when unhealthy:** `ok: false` and one or more checks failed.

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

## Logs and failures

- **Next.js:** stdout/stderr of `npm run start` (or your process manager logs).
- **Pipeline failures:** Check `PipelineRun.error`, `PipelineStepRun.notes` (error code prefix), and RUN_REPORT.md artifacts per lead.
- **Auth redirect loops:** Ensure `NEXTAUTH_URL` matches the exact URL users hit and `AUTH_SECRET` is set.
