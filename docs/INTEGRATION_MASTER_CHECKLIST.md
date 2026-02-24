# Integration Master Checklist

**Single source of truth for what exists, what's partial, and what's missing across the app.**

Status key: ✅ done | 🟡 partial | 🔴 missing | ⏳ later/backlog

---

## 1) Signal Engine

| Item | Status | Current Implementation | Missing Pieces | Next Action | Owner |
|------|--------|------------------------|----------------|-------------|-------|
| **RSS/Atom research** | ✅ | `src/lib/research/adapters/rss.ts`, `RESEARCH_FEED_URL`, cron `POST /api/research/run` | — | — | code |
| **Upwork research** | 🟡 | Adapter exists `src/lib/research/adapters/upwork.ts` | API auth, full flow | Wire OAuth if needed | code |
| **LinkedIn research** | 🔴 | — | API, source adapter | Add to backlog | — |
| **Reddit / X research** | 🔴 | — | API, source adapter | Add to backlog | — |
| **Job boards research** | 🔴 | — | Indeed, LinkedIn Jobs adapters | Add to backlog | — |
| **Review sites** | 🔴 | — | G2, Capterra, Trustpilot | Add to backlog | — |
| **Meta Ads data** | ✅ | `src/lib/meta-ads/`, dashboard, trends, recommendations | — | — | code |
| **Google Ads** | 🔴 | — | API, read-only monitor | Add to backlog | — |
| **LinkedIn Ads** | 🔴 | — | API | Add to backlog | — |
| **TikTok / other ads** | 🔴 | — | API | Add to backlog | — |
| **GA4** | 🔴 | — | API, Search Console | Add to backlog | — |
| **Search Console** | 🔴 | — | API | Add to backlog | — |
| **Performance monitoring** | 🟡 | `src/lib/perf.ts`, `withRouteTiming`, Prisma slow-query log | Dashboard latency visibility | Add ops-health latency card | code |

---

## 2) Lead Engine

| Item | Status | Current Implementation | Missing Pieces | Next Action | Owner |
|------|--------|------------------------|----------------|-------------|-------|
| **Leads capture** | ✅ | Site form `/api/site/leads`, IMAP worker, research pipeline | — | — | code |
| **Lead enrichment** | ✅ | `runEnrich`, `src/lib/pipeline/enrich.ts` | — | — | code |
| **Lead scoring** | ✅ | `runScore`, `src/lib/pipeline/score.ts` | — | — | code |
| **Pipeline stages** | ✅ | NEW → ENRICHED → SCORED → APPROVED/REJECTED → BUILDING → SHIPPED | — | — | code |
| **Follow-ups** | 🟡 | Follow-up sequence UI, manual touch logging | Auto-reminders, sequence cadence | Improve follow-up queue | operator |
| **Calls booked** | 🔴 | — | Calendly sync | Add Calendly integration | — |
| **CRM sync** | 🔴 | — | HubSpot, Pipedrive, etc. | Add to backlog | — |
| **Conversion visibility** | 🟡 | `/dashboard/conversion`, Metrics, deal outcome | Attribution by channel | Add channel attribution | code |
| **Inputs/process/outputs visibility** | 🟡 | Artifacts, PipelineRun, step notes | Consolidated view | — | — |

---

## 3) Execution Engine

| Item | Status | Read-only vs Write | Dry-run | Auditability | Safety Limits |
|------|--------|--------------------|---------|--------------|---------------|
| **Proposal generation** | ✅ | Write (artifact) | N/A | Artifact stored | Human approval gate |
| **Meta Ads actions** | ✅ | Write (pause/resume/budget) | Yes (default ON) | ActionLog | Protected, cooldown, cap |
| **Build Ops** | ✅ | Write (project) | N/A | Manual gate | APPROVED + proposal required |
| **Deploys** | 🟡 | Read (status) | N/A | Deploy logs | — |
| **Notifications** | ✅ | Write (email, webhook) | N/A | Send logs | Best-effort |
| **Action audit logs** | ✅ | — | — | MetaAdsActionLog, pipeline logs | — |
| **Guardrails** | ✅ | — | — | Protected campaigns, cooldown, daily cap | — |

---

## 4) Proof Engine

| Item | Status | Current Implementation | Missing Pieces | Next Action | Owner |
|------|--------|------------------------|----------------|-------------|-------|
| **Results ledger** | ✅ | `OwnedAudienceLedger`, `/api/results-ledger` | — | — | code |
| **Proof pages** | ✅ | `/dashboard/proof`, POST `/api/proof/generate` | — | — | code |
| **Case study capture** | 🟡 | Client Success card, outcomes | Structured case study artifact | Add case study template | operator |
| **Before/after evidence** | 🟡 | Result target, client success | Automated capture | — | — |
| **Testimonials / outcomes** | 🟡 | Client feedback in Client Success | Dedicated testimonial flow | — | — |
| **Reusable proof snippets** | ✅ | Checklist, proof post | — | — | code |
| **Proof automation** | 🟡 | Generate from lead | Auto-suggest from outcomes | — | — |

---

## 5) Operator Engine

| Item | Status | Current Implementation | Missing Pieces | Next Action | Owner |
|------|--------|------------------------|----------------|-------------|-------|
| **Command Center** | ✅ | `/dashboard/command`, CommandSection1/2 | — | — | code |
| **Ops Health** | ✅ | `/dashboard/ops-health`, `getOpsHealth()` | — | — | code |
| **Metrics** | ✅ | `/dashboard/metrics`, pipeline runs | — | — | code |
| **Checklists** | ✅ | `/dashboard/checklist`, proof checklist | — | — | code |
| **Deploy health** | 🟡 | `/dashboard/deploys` | Build-time visibility | — | — |
| **App speed checks** | 🟡 | `src/lib/perf.ts`, PERFORMANCE_TRIAGE | Daily sanity check | Add to APP_SPEED doc | — |
| **Tier A tests** | 🟡 | Vitest, rules, guardrails | More coverage | — | code |
| **Tier B tests** | 🟡 | Playwright, smoke, full-flow | — | — | code |
| **Logging / troubleshooting** | 🟡 | `[SLOW]` logs, error codes | Central log viewer | — | — |

---

## 6) Growth Channels (Cross-engine map)

| Channel | Signal Source | Action Path in App | Outcome Tracked? | Current Gaps |
|---------|---------------|--------------------|------------------|--------------|
| **Meta Ads** | Meta Graph API | Dashboard → Recommendations → Apply | CPL, leads, spend | — |
| **Google Ads** | — | — | — | No integration |
| **LinkedIn** | — | — | — | No integration |
| **Upwork** | Adapter stub | Research → Lead → Pipeline | — | Adapter not wired |
| **Blog / SEO** | — | — | — | No GA4/Search Console |
| **Email / cold outreach** | IMAP | Lead → Pipeline | — | No sequence tracking |
| **Calendly** | — | — | — | No integration |
| **Site form** | `/api/site/leads` | Lead → Pipeline | Yes | — |
| **Referral** | — | LeadTouch, referrals | Partial | — |

---

## Top 10 Missing Capabilities (ranked by business impact)

1. **Upwork research ingestion** — Direct lead flow from Upwork jobs
2. **Calendly integration** — Track booked calls, no-show, conversion
3. **GA4 + Search Console** — Site visibility, conversion attribution
4. **Lead scoring improvements** — Better qualification signals
5. **Follow-up automation** — Reminders, sequence cadence
6. **Google Ads read-only** — Second ad platform visibility
7. **Proposal send integration** — Mailto/Gmail SMTP or API
8. **Channel attribution** — Lead source → conversion by channel
9. **Stripe / payments visibility** — Cash collected
10. **Slack/Discord operator alerts** — More alert channels

---

## Fastest Wins (1–3 days)

| Win | Effort | Impact |
|-----|--------|--------|
| Wire Upwork adapter (if API ready) | 1–2d | Signal |
| Add Calendly webhook stub | 1d | Lead |
| GA4 read-only API (basic) | 1–2d | Signal |
| Add channel to lead source display | 0.5d | Visibility |
| Improve follow-up queue UX | 1d | Lead |

---

## Medium Lifts (3–7 days)

| Lift | Effort | Impact |
|-----|--------|--------|
| Calendly full integration | 3–5d | Lead |
| Google Ads read-only monitor | 3–7d | Signal |
| Proposal send integration | 3–5d | Execution |
| Lead scoring improvements | 3–5d | Lead |
| Stripe/Payments visibility | 3–5d | Proof |

---

## Heavy Lifts (1–3+ weeks)

| Lift | Effort | Impact |
|-----|--------|--------|
| LinkedIn Ads + posting | 1–2w | Signal + Growth |
| CRM sync (HubSpot) | 2–3w | Lead |
| Full outreach automation | 2–3w | Lead |
| Multi-ad-platform dashboard | 2–3w | Signal |

---

## Do Not Build Yet

- Coach OS / Mastermind layer
- Pattern library / A/B experiments
- Full marketing suite beyond positioning + proposal
- AgentPilot schema/orchestration
- BitBrain tool suite
- Auto-send proposals or auto-build without approval
- Cold outreach / DM automation
- New ad/campaign creation flows
- Creative generation/editing

---

## Definition of Done (new integration)

A new integration is **done** when:

| Criterion | Required |
|-----------|----------|
| **Signal** | Data ingested or fetched; visible in app |
| **Decision** | Human or AI can decide from data |
| **Action** | Action path exists (approve/apply/dismiss) |
| **Output** | Audit trail (log, artifact, or action log) |
| **Audit** | Who/what/when traceable |
| **Test** | Tier A (unit) or Tier B (manual) smoke test |

---

## References

- [docs/INTEGRATION_ROADMAP_PHASES.md](./INTEGRATION_ROADMAP_PHASES.md)
- [docs/APP_SPEED_AND_USABILITY_CHECKLIST.md](./APP_SPEED_AND_USABILITY_CHECKLIST.md)
- [docs/META_ADS_MONITOR_RUNBOOK.md](./META_ADS_MONITOR_RUNBOOK.md)
- [docs/COMMAND_CENTER_RUNBOOK.md](./COMMAND_CENTER_RUNBOOK.md)
- [docs/RESEARCH_ENGINE_SPEC.md](./RESEARCH_ENGINE_SPEC.md)
- [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)
