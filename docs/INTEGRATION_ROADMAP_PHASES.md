# Integration Roadmap — Phased Implementation

**Practical phased roadmap for expanding integrations.** Order prioritizes revenue core, then presence, then ops automation.

---

## Phase 1 — Revenue Core

**Business outcome:** More leads, better conversion, faster proposal-to-close.

| Item | Description |
|------|--------------|
| Upwork research ingestion | Wire Upwork adapter; signals only first (no auto-apply) |
| Lead scoring improvements | Better qualification signals, human-risk dimensions |
| Proposal assist pipeline reliability | Retry hardening, error visibility, idempotency |
| Calendly integration | Track booked calls, no-show, conversion |
| Proof capture improvements | Easier before/after, case study template |

### Phase 1 — Required env vars / credentials

| Integration | Env Vars |
|-------------|----------|
| Upwork | `UPWORK_API_KEY`, `UPWORK_API_SECRET` (OAuth) |
| Calendly | `CALENDLY_WEBHOOK_SECRET`, `CALENDLY_ACCESS_TOKEN` |

### Phase 1 — DB models

| Model | New or Existing | Notes |
|-------|-----------------|-------|
| Lead | Existing | Add `calendlyEventId` or similar if needed |
| Artifact | Existing | RESEARCH_SNAPSHOT for Upwork |
| New: CalendlyEvent? | Optional | Or store in Artifact meta |

### Phase 1 — API routes to add

| Route | Purpose |
|-------|---------|
| `POST /api/calendly/webhook` | Receive Calendly event (invitee.created, etc.) |
| `GET /api/calendly/events` | Optional: list upcoming |
| Research: extend `runResearchDiscoverAndPipeline` | Add Upwork adapter when enabled |

### Phase 1 — UI components / pages / cards

| Component | Location | Purpose |
|-----------|----------|---------|
| Calendly events card | Lead detail or Command | Show booked calls |
| Upwork source badge | Lead list | Indicate source |
| Proof case study template | Proof page | Structured capture |

### Phase 1 — Guardrails

- Upwork: signals only; no auto-send; same pipeline gates
- Calendly: webhook verify signature; no PII exposure

### Phase 1 — Tier A tests (automated/local)

- Upwork adapter: mock response, dedupe logic
- Calendly webhook: signature validation, payload parse

### Phase 1 — Tier B tests (manual prod/MCP browser)

- Create lead from Upwork (if wired)
- Book Calendly event → verify appears in app

### Phase 1 — Risks / failure modes

| Risk | Mitigation |
|------|------------|
| Upwork rate limits | Throttle, backoff |
| Calendly webhook replay | Verify signature, idempotency |
| Pipeline overload | Limit per run |

### Phase 1 — Rollback strategy

- Disable Upwork adapter via env
- Disable Calendly webhook route
- No DB migrations required for minimal version

### Phase 1 — What success looks like

- Upwork jobs → Lead (when adapter wired)
- Calendly booked call → visible on lead or dashboard
- Proof capture faster (template)
- Pipeline retries more reliable

---

## Phase 2 — Presence + Demand

**Business outcome:** Site visibility, second ad platform, content/proof reuse.

| Item | Description |
|------|--------------|
| GA4 + Search Console visibility | Read-only; traffic, conversions, queries |
| Google Ads read-only monitor | Spend, clicks, conversions (no actions) |
| LinkedIn posting workflow | Manual-assisted first (draft in app, post manually) |
| Content/proof reuse loop | Proof → checklist → social snippet |

### Phase 2 — Required env vars / credentials

| Integration | Env Vars |
|-------------|----------|
| GA4 | `GA4_PROPERTY_ID`, `GOOGLE_APPLICATION_CREDENTIALS` or OAuth |
| Search Console | `GOOGLE_APPLICATION_CREDENTIALS` or OAuth |
| Google Ads | `GOOGLE_ADS_CUSTOMER_ID`, OAuth |
| LinkedIn | `LINKEDIN_ACCESS_TOKEN` (posting) |

### Phase 2 — DB models

| Model | New or Existing | Notes |
|-------|-----------------|-------|
| Artifact | Existing | Store GA4/Ads snapshots |
| Optional: AnalyticsSnapshot | New | Daily rollups |

### Phase 2 — API routes to add

| Route | Purpose |
|-------|---------|
| `GET /api/analytics/ga4` | GA4 summary |
| `GET /api/analytics/search-console` | Search Console summary |
| `GET /api/google-ads/dashboard` | Read-only (like Meta) |
| `POST /api/linkedin/draft` | Create draft post (manual publish) |

### Phase 2 — UI components / pages / cards

| Component | Location | Purpose |
|-----------|----------|---------|
| GA4 card | Ops Health or new Analytics page | Traffic, conversions |
| Search Console card | Same | Queries, clicks |
| Google Ads dashboard | New tab or card | Read-only KPIs |
| LinkedIn draft | Command or Content | Draft → copy to post |

### Phase 2 — Guardrails

- All read-only for GA4, Search Console, Google Ads
- LinkedIn: draft only; no auto-publish

### Phase 2 — Tier A tests

- GA4/Ads: mock API responses

### Phase 2 — Tier B tests

- Verify GA4 data loads
- Verify Google Ads dashboard loads

### Phase 2 — Risks / failure modes

| Risk | Mitigation |
|------|------------|
| Google API quotas | Cache, batch |
| OAuth token expiry | Refresh flow |

### Phase 2 — Rollback strategy

- Remove routes; hide UI cards

### Phase 2 — What success looks like

- GA4 traffic visible in app
- Google Ads spend/CPC visible
- LinkedIn draft generated from proof

---

## Phase 3 — Ops + Automation

**Business outcome:** Payments visibility, contract tracking, more alert channels.

| Item | Description |
|------|--------------|
| Stripe/Payments visibility | Read-only; revenue, invoices |
| Contracts (status tracking) | PandaDoc/DocuSign or manual status |
| Slack/Discord operator alerts | Extend notify; more channels |
| More ad platforms or outreach | LinkedIn Ads, etc. |

### Phase 3 — Required env vars / credentials

| Integration | Env Vars |
|-------------|----------|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Slack | `SLACK_WEBHOOK_URL` or Bot token |
| Discord | `DISCORD_WEBHOOK_URL` (already used) |

### Phase 3 — DB models

| Model | New or Existing | Notes |
|-------|-----------------|-------|
| Optional: PaymentRecord | New | Or Artifact |
| Contract status | Extend Lead or Artifact | — |

### Phase 3 — API routes to add

| Route | Purpose |
|-------|---------|
| `GET /api/stripe/summary` | Revenue, invoices |
| `POST /api/stripe/webhook` | Payment events |
| Extend `sendOperatorAlert` | Slack channel |

### Phase 3 — UI components

| Component | Location | Purpose |
|-----------|----------|---------|
| Payments card | Command or Settings | Cash collected |
| Contract status | Lead detail | Signed/pending |

### Phase 3 — Guardrails

- Stripe: read-only or webhook verify
- No auto-charge

### Phase 3 — What success looks like

- Stripe revenue visible
- Alerts to Slack
- Contract status tracked

---

## Recommended order

1. **Phase 1** — Revenue core (Upwork, Calendly, proof)
2. **Phase 2** — Presence (GA4, Google Ads, LinkedIn draft)
3. **Phase 3** — Ops (Stripe, Slack, contracts)

---

## References

- [docs/INTEGRATION_MASTER_CHECKLIST.md](./INTEGRATION_MASTER_CHECKLIST.md)
- [docs/RESEARCH_ENGINE_SPEC.md](./RESEARCH_ENGINE_SPEC.md)
- [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)
