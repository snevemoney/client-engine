# Integrations Control Center

**Where:** Dashboard → Settings → Integrations section (scroll down)

## What it does (V1)

The Integrations section is a **control center** for external platform connections. It lets you:

- View status per platform (Not connected / Connected / Error / Disabled)
- Configure credentials (API token, account ID, base URL) via a simple modal
- Run a test for each provider (placeholder or real where implemented)
- Disconnect or disable a provider

## What "connected" means in V1

- **Connected:** A record exists in `IntegrationConnection` with valid config (e.g. access token set) and `status = connected`.
- **Not connected:** No record or no credentials.
- **Error:** Last test failed or `lastError` set.
- **Disabled:** `isEnabled = false`; connection exists but is turned off.

V1 does **not** perform full OAuth flows or live ingestion. It stores config and status so future phases can wire real OAuth and sync logic.

## Supported providers

| Provider       | Used by                                  | Test (V1)                |
|----------------|------------------------------------------|---------------------------|
| Meta           | Ads monitor, Pixel/CAPI lead tracking     | Real token check          |
| Google Ads     | Ads spend/performance                     | Placeholder               |
| LinkedIn       | Lead research, outreach                   | Placeholder               |
| Upwork         | Lead research ingestion                  | Placeholder               |
| Fiverr         | Marketplace presence                     | Placeholder               |
| X (Twitter)    | Social signals                           | Placeholder               |
| Reddit         | Community research                       | Placeholder               |
| YouTube        | Channel performance                      | Placeholder               |
| Google Analytics (GA4) | Site traffic, funnel visibility | Placeholder       |
| Search Console | Search performance                      | Placeholder               |
| Stripe         | Payments, results tracking               | Placeholder               |
| Calendly       | Calls booked                             | Placeholder               |
| CRM            | Generic placeholder for future CRM sync  | Placeholder               |

## API routes

- `GET /api/integrations` — List providers and connection status
- `PATCH /api/integrations/[provider]` — Update config, status, `isEnabled`
- `POST /api/integrations/[provider]/test` — Test connection (real for Meta, placeholder for others)
- `POST /api/integrations/[provider]/disconnect` — Clear config and set status to `not_connected`

## Config fields (generic modal)

- Access token
- Account ID
- Base URL / webhook
- Enable toggle

## Limitations (V1)

1. **No encryption** — Tokens/config stored in plain JSON. Use encryption helpers later if they exist.
2. **No OAuth flows** — Manual token entry only.
3. **No ingestion** — Platform-specific sync/ingestion is not built here; only config/status storage.
4. **Meta only real test** — Other providers return "Test not implemented yet".

## Deploy steps (including Prisma)

1. Run `npx prisma db push` to apply `IntegrationConnection` model.
2. Build and start as usual (`npm run build`, `npm run start` or your process manager).
