# Next: R1 Research Engine + “10 real clients”

**Goal:** “I go to work and come back to drafted proposals from real opportunities.”

---

## Will it work automatically while I’m at my 9–5?

**Yes**, if the app runs as a service and you have a reliable trigger.

**Required for hands-off automation:**

- App running 24/7 (systemd / pm2 / Docker).
- DB reachable.
- A trigger that runs without you: email ingestion worker **or** scheduled research cron (R1).

**Strongly recommended:**

- **/api/health** monitored (e.g. UptimeRobot).
- A notification channel (email/Discord) for:
  - pipeline run failures,
  - health check failures,
  - “new proposals ready” (or similar).

Without notifications, you only see problems when you log in.

---

## R1: Research → Lead Factory (before production)

**Clarification (“zero input”):**

- **Zero input for drafting proposals:** yes — R1 can create leads + run pipeline so proposals are drafted automatically.
- **Zero input for sending / contacting clients:** no — do not auto-send; platform ToS and anti-spam vary; auto-contact at scale risks bans and legal issues.

**Correct target:** e.g. *10 real opportunities ingested per day/week, with proposals drafted and queued for you to approve/send.*

**First source (recommended):** **Upwork API** (official GraphQL job search). Avoids scraping and ToS issues. Other sources only if they offer RSS/feeds/APIs or you have permission.

**R1 components (minimal, production-safe):**

1. **Discoverer** — pull opportunities from allowed sources (start with Upwork API).
2. **Extractor** — turn raw posting into normalized “Research Snapshot” (title, company, text, contact path).
3. **Dedupe** — skip if `sourceUrl` (canonical) already seen.
4. **Filter/Score** — reject low-signal (no budget/contact path, irrelevant, internships, etc.).
5. **Lead creator** — create Lead + RESEARCH_SNAPSHOT artifact; set `source`, `sourceUrl`.
6. **Auto pipeline trigger** — `runPipelineIfEligible(leadId, "research_ingested")`.

**Automation:**

- VPS cron every 45 minutes (or hourly): discover → create leads → pipeline drafts proposals.
- UI shows “new proposals ready”; you approve/revise and send manually.

**Next build order:**

1. Implement R1 Research Engine using **Upwork API** as the first source.
2. Add notifications (so failures don’t hide).
3. Deploy + cron + monitor /api/health.

---

## “10 real clients” — measurable definitions

Pick one (or more) so the system can be measured:

| # | Definition | What automation can guarantee |
|---|------------|--------------------------------|
| 1 | **10 real leads ingested** | Opportunities found online, deduped, stored. |
| 2 | **10 proposal drafts generated** | Lead + positioning + proposal artifacts exist. |
| 3 | **10 proposals sent** | You clicked “mark sent”. |
| 4 | **10 deals won** | `dealOutcome = won`. |

R1 can aim to guarantee **#1–#2** if sources provide enough postings. **#3–#4** are assisted by the system but not fully automatic.
