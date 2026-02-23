# Production Critic: PBD 6-Stage Sales Framework Audit

**Lens:** Private operator app (freelance → experience → future product).  
**Structure:** Patrick Bet-David sales stages.  
**Constraints:** Human-gated only, no auto-send/auto-build; focus on discipline, leak visibility, referrals, relationship maintenance; simple tables/fields/cards.

---

## 1. Audit: Current App vs 6 Stages

### 1) Prospecting

| What exists | Gaps |
|------------|------|
| `Lead.source`, `leadSourceChannel`, `leadSourceType`, `sourceDetail`, `introducedBy` | No **company** field (only in capture form payload; not on Lead). Prospecting Sources card uses **this month** only; no trend or “leads this week by channel.” |
| ProspectingSourcesCard: leads/qualified/won/cash by channel | New leads often have `leadSourceChannel` null → all fall to OTHER. Capture flow doesn’t require channel. |
| Sales Leak: `prospectingCount` = new leads this week | No “prospecting leak” metric (e.g. 0 new leads this week while pipeline has PROSPECTING leads). |

**Verdict:** Schema and UI support channel; **data discipline** is the leak (channel not set at capture, no company on Lead). Metrics are present but “this month” only.

---

### 2) Approach / Contact

| What exists | Gaps |
|------------|------|
| `lastContactAt`, `nextContactAt`, `touchCount`, LeadTouch (type, direction, summary, outcome, nextTouchAt) | No **firstContactAt** (first outreach date). “New contacts made” in Sales Leak = any touch this week, not “first contact sent.” |
| Sales Leak: `newContactsMade` (lastContactAt or nextContactAt in week) | No count of “leads in APPROACH_CONTACT with no touch in 7 days” as its own leak. |
| Touch types: EMAIL, CALL, LINKEDIN_DM, MEETING, FOLLOW_UP, REFERRAL_ASK, CHECK_IN | Good. |

**Verdict:** Contact logging is strong. Missing: **firstContactAt** for “first outreach sent” and a dedicated **approach leak** (contacts made vs leads waiting for first contact).

---

### 3) Presentation

| What exists | Gaps |
|------------|------|
| `proposalSentAt`; proposal artifact; “Mark proposal sent” | **Presentation** in PBD = call/demo, not “proposal sent.” We conflate “proposal sent” with “presentation.” |
| Sales Leak: `firstContactsSent` = proposals sent this week; `presentationsCount` = proposal sent this week OR (stage FOLLOW_UP/PRESENTATION) | No **first call / meeting date** or “presentation happened” field. MEETING touch type exists but not aggregated as “presentations this week.” |

**Verdict:** We measure **proposal sent**, not **presentation (call/demo)**. Minimal fix: treat MEETING touches as presentation events and optionally add **presentationAt** (date of first discovery/demo call) for clarity. No need for heavy “presentation builder”—keep it a date + optional note.

---

### 4) Follow-up

| What exists | Gaps |
|------------|------|
| `nextContactAt`, `lastContactAt`, `followUpCount`, `followUpCadenceDays`, `permissionToFollowUp`, `followUpStage` | FollowUpDiscipline card and salesLeak use **nextContactAt** correctly. |
| FollowUpDisciplineCard: due today, overdue, no touch 7d, avg touches to close, overdue list with links | **followUpsDueToday** in Money Scorecard is “sent no outcome” count, not “nextContactAt due today”—inconsistent. Prefer one definition: nextContactAt. |
| Failures & Interventions: stale proposals (sent 7+ days, no outcome) | Good. Overdue list in Follow-up card is the main “do this” queue. |
| Lead detail: leak warning “No next date = incomplete” for APPROACH_CONTACT, PRESENTATION, FOLLOW_UP | Good. |

**Verdict:** Follow-up is **operationally strong**. Only fix: align Money Scorecard `followUpsDueToday` with nextContactAt (or drop and rely on Follow-up Discipline card).

---

### 5) Referrals

| What exists | Gaps |
|------------|------|
| `referralAskStatus`, `referralAskAt`, `referralCount`, `referralNames`; LeadReferral (referredName, company, status) | **referralAskAt** is not set when user marks “asked” in UI—only status is PATCHed. So “referral asks this week” undercounts unless user manually sets date. |
| ReferralEngineCard: asks this week, received this month, conversion %, eligible (shipped+won, not asked) | Eligible logic is correct. |
| SalesProcessPanel: referral ask dropdown (none/primed/asked/received); log referral form | Schema comment says `not_asked | asked | received`; UI has “primed.” Accept both; no schema change. |
| Sales Leak: referralAsksMade (asked + referralAskAt in week) | Accurate only if referralAskAt is set—**needs API fix**. |

**Verdict:** One critical fix: **set referralAskAt = now when referralAskStatus is set to “asked”** (if not already set). Rest is solid.

---

### 6) Maintain customer relationship

| What exists | Gaps |
|------------|------|
| `relationshipStatus` (active/dormant/nurture), `relationshipLastCheck` | **relationshipTouches** in Sales Leak is **always 0**—never computed. No count of CHECK_IN touches or “relationshipLastCheck updated this week.” |
| SalesProcessPanel: relationship status dropdown, last check-in date | Good. No queue of “past clients to check in” (shipped+won, no touch in 90d or relationshipLastCheck old). |
| Referral eligible = shipped+won, not asked | Relationship maintenance is separate: **nurture** past clients so they refer and re-buy. |

**Verdict:** **Missing:** (1) Compute **relationshipTouches** (e.g. CHECK_IN touches this week or relationshipLastCheck updated this week). (2) Optional: “Nurture queue” count (shipped+won, no touch in N days or relationshipLastCheck &gt; N days). Simple table/card, no automation.

---

## 2. Missing Data Fields, Metrics, UI (Summary)

| Stage | Missing data fields | Missing metrics | Missing UI |
|-------|---------------------|-----------------|------------|
| Prospecting | `company` on Lead (optional) | Leads this week by channel; “prospecting leak” flag | Capture: require or default leadSourceChannel; Leads table: show channel |
| Approach | `firstContactAt` (optional) | “First contacts sent this week”; “approach leak” (in stage, no touch 7d) | — |
| Presentation | `presentationAt` (optional) | “Presentations this week” from MEETING touches or presentationAt | — |
| Follow-up | — | Align Money `followUpsDueToday` with nextContactAt | — |
| Referrals | — | referralAskAt set when status → asked | — |
| Relationship | — | relationshipTouches (CHECK_IN or relationshipLastCheck this week); nurture queue count | Card: “Relationship maintenance” with count + list (backlog) |

---

## 3. Minimum Implementation (Operationally Strong, Not Overbuilt)

### Schema (new fields only)

- **Lead**
  - `company String?` — optional; for display in overdue/nurture lists and reports.
  - `firstContactAt DateTime?` — optional; set when first outbound touch is logged (or manually).
  - `presentationAt DateTime?` — optional; first call/demo date (manual or from first MEETING touch).

No new models. No new enums.

### API

- **PATCH /api/leads/[id]**  
  - When `referralAskStatus` is set to `"asked"`, set `referralAskAt` to `now` if not already set. **(Do now.)**
- **POST /api/leads/[id]/touches**  
  - Optional: when creating first outbound touch (EMAIL/CALL/LINKEDIN_DM/MEETING), set `firstContactAt` to now if null. **(Backlog.)**  
  - Optional: when type is MEETING and lead has no `presentationAt`, set `presentationAt` to now. **(Backlog.)**

### UI cards / pages

- **Command Center**
  - **Sales Leak card:** Populate **relationshipTouches**: count leads where (relationshipLastCheck in this week) OR (exists LeadTouch type CHECK_IN this week). **(Do now: metric only; optional: “Nurture queue” link later.)**
  - **Follow-up Discipline:** Already has overdue list. No change.
  - **Referral Engine:** Add one line: “When you mark ‘Asked’, date is set automatically.” **(Do now: small copy or tooltip.)**
- **Lead detail**
  - Sales process: when user sets referral ask to “asked”, API sets date—no UI change.
  - Optional (Backlog): show **firstContactAt** / **presentationAt** in Sales stage block if set.
- **Leads list**
  - Optional (Backlog): column or filter for `leadSourceChannel` and `salesStage`.

### Dashboard metrics

- **Money Scorecard:** `followUpsDueToday`: derive from leads with `nextContactAt` in today (and status not won/rejected), instead of “sent no outcome.” **(Do now for consistency.)**
- **Sales Leak:** `relationshipTouches` computed as above. **(Do now.)**
- **Prospecting Sources:** Keep “this month”; add “Leads this week” row or small note. **(Backlog.)**

### Weekly checklist (additions)

In **docs/WEEKLY_PRODUCTION_CRITICISM_CHECKLIST.md**, section **6b) Sales Leaks (PBD)** already exists. Add:

- Under **Relationship leak:** “Evidence to check: Command Center → Sales Leak card → **Relationship touches** (CHECK_IN or last check-in this week). Relationship status + Last check-in on lead detail.”
- Optional: one line under Prospecting: “Set **leadSourceChannel** on every new lead (or at capture) so Prospecting Sources is accurate.”

---

## 4. Prioritization: Do Now vs Backlog

### Do now (production-ready, high impact)

1. **API: Set `referralAskAt` when `referralAskStatus` → "asked"** (PATCH /api/leads/[id]).
2. **Sales Leak: Compute `relationshipTouches`** (CHECK_IN touches this week + relationshipLastCheck updated this week).
3. **Money Scorecard: `followUpsDueToday`** from nextContactAt due today (align with Follow-up Discipline).
4. **Weekly checklist:** Add relationship-touches evidence line under 6b.

### Backlog (when capacity allows)

- Schema: `company`, `firstContactAt`, `presentationAt` on Lead.
- Touch POST: auto-set firstContactAt / presentationAt when appropriate.
- Prospecting: require or default leadSourceChannel at capture; “leads this week” by channel.
- Command Center: “Nurture queue” card (shipped+won, no touch / old relationshipLastCheck) with link list.
- Leads table: columns or filters for channel and sales stage.

---

## 5. Alignment Check

- **Private app:** All changes are for operator use only; no client-facing automation.
- **Human-gated:** No auto-send, no auto-build; new logic only sets dates or counts for visibility.
- **Cash + client results + reusable leverage:** Referral and relationship metrics support referral asks and nurture; follow-up discipline protects pipeline value; Money Scorecard stays cash- and outcome-oriented.

---

## 6. Output Summary

| Category | Do now | Backlog |
|----------|--------|---------|
| **Schema** | — | company, firstContactAt, presentationAt |
| **API** | PATCH sets referralAskAt when status → asked | Touch POST sets firstContactAt/presentationAt |
| **UI cards** | Sales Leak: relationshipTouches; Referral copy | Nurture queue card; leads table channel/stage |
| **Dashboard metrics** | followUpsDueToday from nextContactAt; relationshipTouches | Prospecting “leads this week” |
| **Weekly checklist** | 6b relationship-touches evidence | Prospecting channel discipline line |
