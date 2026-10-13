# Session: Hardening implementation — 2026-08-27

## Goal
Implement the 2026-08-27 20-point hardening audit (`docs/audits/hardening-20-20260827.md`), not another dry-run. Priority: auth fail-closed, secret fallbacks, then local-safe hygiene. No merge to main, no force-push, no deploy, no history rewrite.

## Decisions Made
- Voice and GitHub webhooks verify HMAC over the **raw body** and fail closed if the secret is unset. No invented secrets.
- Delivery admin URL is built server-side (`GET /api/delivery-projects/[id]/builder/admin`) so `BUILDER_API_KEY` never ships in client JS as `dev-key`.
- Playwright and e2e specs read cron/password from env only. CI throws if cron secrets are missing.
- Money: convert `ContentAsset.cashCollected` and `NetworkingEvent.revenue` to integer cents in Postgres; API/UI still speak dollars.
- Do **not** extract all 259 Prisma-in-handler routes into a service layer. Defer that on the audit table and ROADMAP.

## What Was Built
- `src/lib/crypto/hmac.ts` — shared fail-closed HMAC helpers + tests
- Voice webhook signature; GitHub HMAC; `/api/test` session gate
- Builder `requireBuilderApiKey`; delivery admin redirect
- Playwright / e2e fallback removal; `.env.example` placeholders
- Zod on capture, site/leads, networking-events, leads PATCH
- Pagination on campaigns and cadence; `fetchWithRetry` on Resend
- Prisma migration `20260827_hardening_indexes_money_cents`
- Escalation N+1 batching; email worker singleton
- Audit Fixed vs Deferred table

## Key Insights
- GitHub signature check previously `return true` with an empty-string secret fallback — both had to go for fail-closed.
- `process.env.BUILDER_API_KEY` in a `"use client"` page is always undefined in the browser, so the `dev-key` fallback was the live value.

## Trade-offs Accepted
- Campaigns list stays an array (UI contract) with default take 100 instead of switching to `{ items, pagination }`.
- Remaining Zod/pagination/N+1/service-layer items listed as deferred rather than a sweep.

## Open Questions
- Operator must set `VOICE_WEBHOOK_SECRET` and `GITHUB_WEBHOOK_SECRET` before those webhooks work in any environment.
- Prod still needs `prisma migrate deploy` on a later deploy (not this session).

## Next Steps
- [ ] Set webhook secrets and `BUILDER_API_KEY` in real env files (not in git)
- [ ] Apply migration on deploy
- [ ] Continue deferred items incrementally (service layer, remaining Zod, remaining lists)
