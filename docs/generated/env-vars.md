# Environment Variables

> Auto-generated from .env.example on 2026-08-27. 21 variables.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database (required for app + prisma) |
| `DB_PASSWORD` | — |
| `ADMIN_EMAIL` | Admin sign-in (used by prisma/seed.mjs — set these then run seed) |
| `ADMIN_PASSWORD` | — |
| `ANTHROPIC_API_KEY` | - OPENAI_API_KEY (fallback when Anthropic fails; uses OPENAI_MODEL, default gpt-4.1) |
| `AUTH_SECRET` | Auth (required for login/session; NextAuth / Auth.js) |
| `NEXTAUTH_URL` | /api/auth/* actions (UnknownAction) if AUTH_URL/NEXTAUTH_URL includes a path. |
| `AUTH_TRUST_HOST` | Required for Compose `pro` service (NEXT_PUBLIC_BASE_PATH=/pro on :3204) |
| `PIPELINE_DRY_RUN` | For real lead scores, set to 0 and ensure ANTHROPIC_API_KEY or OPENAI_API_KEY is set. |
| `AGENT_CRON_SECRET` | Set a long random value locally and in prod. Do not commit the real secret. |
| `RESEARCH_CRON_SECRET` | Set a long random value locally and in prod. Do not commit the real secret. |
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
