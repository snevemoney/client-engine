# Environment Variables

> Auto-generated from .env.example on 2026-03-02. 19 variables.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database (required for app + prisma) |
| `DB_PASSWORD` | — |
| `ADMIN_EMAIL` | Admin sign-in (used by prisma/seed.mjs — set these then run seed) |
| `ADMIN_PASSWORD` | — |
| `OPENAI_API_KEY` | OpenAI (required for enrich / score / position / propose / build) |
| `AUTH_SECRET` | Auth (required for login/session; NextAuth) |
| `NEXTAUTH_URL` | Production: must match your public URL (stops redirect loops) |
| `PIPELINE_DRY_RUN` | For real lead scores, set to 0 and ensure OPENAI_API_KEY is set. |
| `RESEARCH_CRON_SECRET` | E2E + local: use this so Bearer auth tests run. Prod: set a strong random secret. |
| `IMAP_HOST` | Email ingestion (worker) — Hostinger IMAP; set IMAP_USER and IMAP_PASS to connect inbox |
| `IMAP_PORT` | — |
| `IMAP_USER` | — |
| `IMAP_PASS` | — |
| `NOTIFY_EMAIL` | Website form → email notification. Use either Resend API or SMTP (Hostinger outgoing). NOTIFY_EMAIL is where you receive the notification. |
| `SMTP_HOST` | Option B: SMTP (internal, e.g. Hostinger) — same mailbox as IMAP for send |
| `SMTP_PORT` | — |
| `SMTP_USER` | — |
| `SMTP_PASS` | — |
| `REDIS_URL` | Queue (worker + app). Dev: redis://localhost:6379. Prod Docker: redis://redis:6379 |
