# Phase 1 Smoke Checklist (copy/paste)

## Integrations Control Center
- [ ] Settings page loads
- [ ] Scroll to Integrations section
- [ ] 8 provider cards render (Meta, Upwork, GA4, Stripe, Google Ads, LinkedIn, YouTube, CRM)
- [ ] Click Connect/Configure on one card; modal opens
- [ ] Enter access token, account ID; Save
- [ ] Status badge shows Connected
- [ ] Last tested / last synced appears when available
- [ ] Click Test — Meta shows real result; others show placeholder
- [ ] Click Disconnect; confirm; status shows Not connected
- [ ] Refresh page; values persist

## Meta Ads
- [ ] /dashboard/meta-ads loads
- [ ] Overview tab: KPI cards, campaigns table (or empty state)
- [ ] Recommendations tab: Generate, Refresh; recs list or empty state
- [ ] Approve / Dismiss / False + / Reset work
- [ ] Apply on approved rec — success or clear blocked message (protected/cooldown/cap)
- [ ] Action History tab: actions list
- [ ] Settings tab: save settings

## Core App Pages (load without crash)
- [ ] /dashboard — Command Centre
- [ ] /dashboard/ops-health
- [ ] /dashboard/sales-leak
- [ ] /dashboard/results
- [ ] /dashboard/leads
- [ ] /dashboard/proposals
- [ ] /dashboard/build-ops
- [ ] /dashboard/metrics
- [ ] /dashboard/chat
- [ ] /dashboard/learning
- [ ] /dashboard/settings
- [ ] /dashboard/proof
- [ ] /dashboard/checklist
- [ ] /dashboard/deploys
- [ ] /dashboard/conversion
- [ ] /dashboard/knowledge
- [ ] /dashboard/meta-ads

## Research Pipeline Visibility
- [ ] Metrics: Recent runs table shows Source, Error columns
- [ ] Command: Workday Run card shows Input/Process/Output on success
- [ ] Workday Run: error display shows research/pipeline/knowledge errors

## Performance
- [ ] Public / and /work load with revalidate (fast)
- [ ] Meta Ads, Metrics show loading skeletons before content
