# Session: Sprint 6 Client Portal — 2026-03-03

## Goal

Implement the client-facing portal for DeliveryProject per the Sprint 6 plan: token-protected public page, client notes API, dashboard integration, builder feedback tagging, auto-notify on preview/deploy, regenerate-from-feedback, and share portal link.

## Decisions Made

- **Token generation:** Option B (lazy) — token created on first "Share portal" click via `POST /api/delivery-projects/[id]/portal-token`, not on project create.
- **Client notes storage:** DeliveryActivity with `type: "client_note"` (not Artifact or new DeliveryNote model).
- **Client notifications:** Only when operator triggers deploy or builder create; skip if no contactEmail. For preview, create token on-the-fly when notifying (so client gets portal link in email).
- **Regenerate from feedback:** Regenerate API now accepts optional `context` body param and auto-pulls latest `client_note` activities when none provided; merges into `bio` for AI content generation.

## What Was Built

### Created
- `src/app/portal/[token]/page.tsx` — Public client portal (server component)
- `src/app/portal/[token]/PortalClient.tsx` — Feedback form (client component)
- `src/app/portal/[token]/not-found.tsx` — 404 for invalid token
- `src/app/api/portal/notes/route.ts` — POST client note submission (no auth)
- `src/app/api/delivery-projects/[id]/portal-token/route.ts` — Generate/copy portal token

### Modified
- `prisma/schema.prisma` — `clientToken` (String?, @unique) on DeliveryProject; `client_note` in DeliveryActivityType
- `src/lib/notify.ts` — `sendResendTo`, `sendSMTPTo`, `notifyClientPreview`, `notifyClientDeployed`, exported `getAppUrl`
- `src/app/api/delivery-projects/[id]/builder/deploy/route.ts` — Call `notifyClientDeployed` when contactEmail + clientToken
- `src/app/api/delivery-projects/[id]/builder/create/route.ts` — Create token if needed, call `notifyClientPreview` when contactEmail
- `src/workers/index.ts` — builder-deploy worker calls `notifyClientDeployed`
- `src/app/api/delivery-projects/[id]/builder/regenerate/route.ts` — Accept `context` body; auto-pull client_note activities into bio
- `src/app/dashboard/delivery/[id]/page.tsx` — SharePortalButton, ClientNotesSection, Regenerate from feedback label when client notes exist

## Key Insights

- Portal token uses `crypto.randomBytes(18).toString("base64url")` for URL-safe uniqueness (no cuid package in deps).
- Client notifications require both contactEmail (from pipelineLead) and portal URL; deploy worker needed project fetch with pipelineLead + clientToken.
- Regenerate API already had rich clientInfo; appending client feedback to `bio` keeps builder API contract unchanged.

## Trade-offs Accepted

- Preview notification creates token on-the-fly when contactEmail exists (slight deviation from "token only on share" — we create when we first email the client).
- Deploy history: DeliveryActivity with `metaJson.action === "builder_site_deployed"` already logs deploys; no separate deploy_log artifact.

## Next Steps

- [ ] E2E test for portal flow (optional)
- [ ] Verify notifyClientPreview/Deployed with real Resend/SMTP in staging
