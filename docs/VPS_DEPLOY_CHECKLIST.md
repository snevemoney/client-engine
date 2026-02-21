# VPS Deploy Ready Checklist

**One-command deploy (SSH deploy key):** See [DEPLOY_SSH_SETUP.md](DEPLOY_SSH_SETUP.md) for switching the server to SSH + deploy key and the `deploy-client-engine.sh` one-liner.

## Required env vars (production)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | NextAuth secret; generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full app URL e.g. `https://evenslouis.ca` |
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

**Email ingestion (worker):** If using Hostinger email, ensure IMAP is enabled for the mailbox and app/password settings match provider requirements. Restart the worker after changing any `IMAP_*` env vars.

**Website form notification:** Set `NOTIFY_EMAIL` and either `RESEND_API_KEY` or `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` (Hostinger: `smtp.hostinger.com`, port 465). You can reuse `IMAP_USER`/`IMAP_PASS` for SMTP if using the same mailbox.

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
