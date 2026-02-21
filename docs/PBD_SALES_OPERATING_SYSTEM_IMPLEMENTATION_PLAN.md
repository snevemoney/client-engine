# PBD Sales Operating System — Implementation Plan

**Context:** Integrate Patrick Bet-David’s 6-step sales discipline into the private operator app as a **parallel sales lens** alongside the existing delivery pipeline. Mission: find the leak, enforce follow-up, capture referrals, maintain relationships — without violating axioms (no cold outreach, no auto-send, human owns positioning and final send).

**Read first:** `docs/CLIENT_ENGINE_AXIOMS.md`, `PROJECT_CONTEXT.md`.

---

## 1. Design principles

- **Sales pipeline ≠ delivery pipeline.** Keep both:
  - **Sales pipeline (before money):** Prospecting → Approach & Contact → Presentation → Follow-up → Referral → Relationship Maintenance.
  - **Delivery pipeline (after money):** NEW → ENRICHED → SCORED → APPROVED/REJECTED → BUILDING → SHIPPED.
- **No cold outreach.** Prospecting in this app = warm / network / referral only. No cold DM, no cold email campaigns. Source tracking reflects that.
- **Human in the loop.** No auto-send, no auto-build. Scripts are one-click **templates** for the operator to edit and send.
- **Leak-first.** The app should answer “Where is the leak this week?” in seconds. Highest-impact UI: Sales Leak card at top of Command Center.
- **Small reversible steps.** Prefer schema additions and new cards over rewriting existing flows. New fields are optional until validations are introduced gradually.

---

## 2. Data model changes

### 2.1 Lead — new optional fields (Phase 1 & 2)

Add to `prisma/schema.prisma` on `Lead`:

```prisma
// ----- Sales operating system (PBD 6 steps) -----
// Stage in sales process (before money). Complements status (delivery).
salesStage           String?   // PROSPECTING | APPROACH_CONTACT | PRESENTATION | FOLLOW_UP | REFERRAL | RELATIONSHIP_MAINTENANCE
nextContactAt       DateTime? // Required for “no next date = incomplete” leak
lastContactAt       DateTime?
followUpCount       Int       @default(0)
followUpCadenceDays Int?      // e.g. 3, 7, 14
permissionToFollowUp Boolean? // true/false when asked “can I follow up later?”
personalDetails     String?   @db.Text // wife/kids/job/event for relationship

// Prospecting source (Phase 2). Axiom: no cold; warm + network + referral only.
leadSourceType      String?   // warm | network_referral (no "cold")
leadSourceChannel   String?   // linkedin | email | event | website | friend | existing_client | other
introducedBy        String?   // optional name or leadId
```

**Migration strategy:** Add columns as optional; backfill `salesStage` from existing `status` where possible (e.g. NEW/ENRICHED → PROSPECTING or APPROACH_CONTACT; proposalSentAt set → PRESENTATION or FOLLOW_UP). No destructive changes.

### 2.2 Referral tracking (Phase 2)

Store on Lead (closed-won) or in artifact meta:

- **Option A (simplest):** Add to `Lead`:
  - `referralAskStatus` — `not_asked | asked | received`
  - `referralAskAt` — DateTime?
  - `referralCount` — Int default 0
  - `referralNames` — String? or Json (optional)
- **Option B:** One artifact per lead type `REFERRAL_ASK_LOG` with meta `{ askedAt, count, names[], scriptUsed }`. Fits existing artifact pattern; no schema change.

Recommendation: **Option A** for quick “referral ask due” filters and Command Center counts; optional artifact for scriptUsed and notes.

### 2.3 Relationship touches (Phase 2)

**Option A:** New model `RelationshipTouch`:

```prisma
model RelationshipTouch {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  type      String   // check_in | congratulation | share_article | personal_note | thank_you | holiday | invite
  notes     String?  @db.Text
  createdAt DateTime @default(now())
}
```

**Option B:** Artifact type `RELATIONSHIP_TOUCH` on lead, meta `{ type, notes }`. Keeps everything in Artifact; no new table.

Recommendation: **Option B** for consistency with client-success layer and fewer migrations. Add `Lead.relationshipTouchCount` or derive from artifact count if needed for scorecards.

### 2.4 Scripts (Phase 3)

Store as **system artifacts** (e.g. on a well-known system lead like “Proof & Checklist Engine”) or in a small `Script` table:

```prisma
model Script {
  id          String   @id @default(cuid())
  slug        String   @unique  // first_follow_up_email | linkedin_message | first_call_opener | reengagement | not_now_scheduling
  salesStage  String   // APPROACH_CONTACT | PRESENTATION | FOLLOW_UP | REFERRAL | RELATIONSHIP_MAINTENANCE
  title       String
  body        String   @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Alternatively: single artifact type `SCRIPT_LIBRARY` with meta `{ scripts: { slug: { stage, title, body } } }`. Prefer **Script table** if you want versioning and per-stage filtering in UI.

### 2.5 PATCH allowlist (leads API)

Extend `ALLOWED_PATCH_FIELDS` in `src/app/api/leads/[id]/route.ts` for new **non–money-path** fields only:

- `salesStage`, `nextContactAt`, `lastContactAt`, `followUpCount`, `followUpCadenceDays`, `permissionToFollowUp`, `personalDetails`
- `leadSourceType`, `leadSourceChannel`, `introducedBy`
- `referralAskStatus`, `referralAskAt`, `referralCount`, `referralNames` (if Option A)

Do **not** allow PATCH for: `proposalSentAt`, `approvedAt`, `buildStartedAt`, `buildCompletedAt`, `dealOutcome`, `status` (set only via dedicated routes).

---

## 3. Sales Leak Detector (top-level card)

### 3.1 Purpose

Answer: **“Where is the leak this week?”** in one glance. Turn sales from emotion into operations.

### 3.2 Data to show (this week)

| Metric | Source |
|--------|--------|
| Prospecting count | Leads created this week (or with `salesStage = PROSPECTING` if set). |
| New contacts made | Leads with `lastContactAt` or `nextContactAt` set this week (or first touch this week). |
| First contacts sent | Heuristic: proposal sent this week, or artifact type “first_contact” if you add it. |
| Presentations / calls held | Leads with proposal sent or presentation artifact; count this week. |
| Follow-ups due / completed | Due: `nextContactAt <= end of week` and not yet contacted; completed: `lastContactAt` in range. |
| Referral asks made | Count where `referralAskStatus = 'asked'` and `referralAskAt` this week. |
| Referral leads received | Count leads with `leadSourceChannel = 'referral'` or `leadSourceType = 'network_referral'` created this week. |
| Relationship touches | Count of RELATIONSHIP_TOUCH artifacts (or RelationshipTouch rows) this week. |

### 3.3 Leak detection logic

Implement in `src/lib/ops/salesLeak.ts`:

- **Inputs:** Same week window; lead list with new fields and artifact counts.
- **Stage funnel:** For each PBD stage, compute “in stage” and “moved to next” counts. Leak = stage with **largest drop-off** (e.g. “31 due in follow-up, 9 done” → leak = Follow-up) or **lowest absolute activity** vs a simple target (e.g. “Prospecting: 14 new contacts, target 50”).
- **Output type:** Reuse/extend `PipelineLeakReport` in `src/lib/ops/types.ts`:
  - `worstLeakStage: string` (e.g. `"FOLLOW_UP"`)
  - `worstLeakReason: string` (e.g. `"31 due, 9 done"` or `"14 new contacts, target 50"`)
  - `stageCounts: Record<stage, { in: number; out?: number; due?: number; done?: number }>`
  - Optional: `targets` from operator settings (e.g. min new contacts per week).

### 3.4 UI — Sales Leak card

- **Location:** Command Center, near top (e.g. under Money Scorecard or next to it).
- **Content:**
  - Title: “Sales Leak (This Week)”.
  - Table or grid: Prospecting count, New contacts, First contacts sent, Presentations, Follow-ups due/done, Referral asks, Referral leads, Relationship touches.
  - **Highlight:** One line in bold or badge: “Leak = Follow-up (31 due, 9 done)” or “Leak = Prospecting (14 new contacts, target 50)”.
- **Component:** `src/components/dashboard/command/SalesLeakCard.tsx`. Data from `getSalesLeakReport()` in `src/lib/ops/salesLeak.ts`.

### 3.5 Operator targets (optional)

Store in operator settings (e.g. `src/lib/ops/settings.ts` or existing settings artifact):

- `salesTargetNewContactsPerWeek: number | null`
- `salesTargetFollowUpsPerWeek: number | null`
- `salesTargetReferralAsksPerMonth: number | null`

Used only for leak **recommendations** (“below target”) and for presentation-overfocus warning (Phase 3). No auto-actions.

---

## 4. PBD 6 stages — parallel lens

### 4.1 Stage enum and mapping from delivery status

- `PROSPECTING` — Building list; not yet in contact.
- `APPROACH_CONTACT` — First touch / first response; not yet presentation.
- `PRESENTATION` — Proposal sent or call/deck presented.
- `FOLLOW_UP` — Post-presentation; follow-up sequence.
- `REFERRAL` — Asking for or receiving referrals (often post–closed-won).
- `RELATIONSHIP_MAINTENANCE` — Non-sales touches; long-term nurture.

**Mapping from existing `Lead.status` (delivery):**

- NEW, ENRICHED, SCORED → treat as PROSPECTING or APPROACH_CONTACT (depending on `proposalSentAt`).
- No proposal yet → APPROACH_CONTACT or PROSPECTING.
- `proposalSentAt` set, no outcome → PRESENTATION or FOLLOW_UP.
- `dealOutcome = 'won'` → can be REFERRAL or RELATIONSHIP_MAINTENANCE.
- `dealOutcome = 'lost'` → can still be RELATIONSHIP_MAINTENANCE.

When `salesStage` is null, derive a “display stage” from delivery status + timestamps for the Leak card and lead list. When `salesStage` is set, use it.

### 4.2 Lead list and detail UI

- **Lead list:** Add optional column “Sales stage” and “Next contact”. Filter by sales stage.
- **Lead detail:** Show current sales stage (editable dropdown); show “Next contact date” (required for non-rejected/closed leads in FOLLOW_UP or APPROACH_CONTACT). Red highlight if “No next date = incomplete” (see §5).

---

## 5. Required validations (incomplete = leak)

### 5.1 Next contact date

- **Rule:** For leads in APPROACH_CONTACT, PRESENTATION, or FOLLOW_UP (and not REJECTED, not closed-won with referral asked), if `nextContactAt` is null, consider the lead **incomplete**.
- **UI:** Lead detail shows “Next contact date” in red with note “No next date = incomplete (leak).”
- **API:** PATCH can set `nextContactAt`. No server-side “block” required in Phase 1; visibility and leak count are enough. Optionally, a dedicated endpoint “leads missing next contact” for the Command Center.

### 5.2 Referral ask (Phase 2)

- **Rule:** When marking `dealOutcome = 'won'`, prompt (in UI) for referral ask status. Not a hard gate: allow marking won without it, but show “Referral ask pending” until set.
- **Referral trigger:** When client-success has positive outcome (e.g. outcome scorecard entry or positive feedback) and delivery is complete, show prompt: “Best time to ask for referrals.” No auto-send; human decides.

---

## 6. Follow-up discipline score

### 6.1 Metrics

- **% follow-ups completed on time:** For leads with `nextContactAt` in the past, count those where `lastContactAt >= nextContactAt` (or next contact was done) vs total due.
- **% leads with next date set:** Among active (non-rejected, non-lost) leads in APPROACH_CONTACT | PRESENTATION | FOLLOW_UP, proportion with `nextContactAt != null`.
- **% leads with notes/details logged:** Proportion with `personalDetails` or recent artifact (e.g. note) in last 7 days.

### 6.2 Implementation

- `src/lib/ops/followUpDiscipline.ts` — function `getFollowUpDisciplineScore()` returning:
  - `pctOnTime: number | null`
  - `pctWithNextDate: number`
  - `pctWithNotes: number`
  - `compositeScore: number` (e.g. average of the three, 0–100).
- Optional: small “Follow-up discipline” block inside Sales Leak card or a separate compact card.

---

## 7. Referral tracking and trigger

### 7.1 Tracking (Phase 2)

- On Lead: `referralAskStatus`, `referralAskAt`, `referralCount`, `referralNames` (or artifact REFERRAL_ASK_LOG).
- When operator marks “Referral asked” or “Referral received,” update via PATCH or dedicated endpoint (e.g. POST `/api/leads/[id]/referral-ask` with `{ status, count?, names? }`).

### 7.2 Referral ask trigger (after positive outcome)

- **Condition:** Lead has `dealOutcome = 'won'` (or SHIPPED) and has at least one of: outcome scorecard entry, positive client feedback, or result target + baseline. And `referralAskStatus !== 'asked'`.
- **UI:** On lead detail or Command Center, show: “Best time to ask for referrals” with link to lead. No automatic message; human sends.

---

## 8. Relationship maintenance (non-sales touches)

### 8.1 Touch types

- check_in, congratulation, share_article, personal_note, thank_you, holiday, invite (coffee/call).

### 8.2 Logging

- **Option B (artifact):** POST to client-success or new endpoint, create artifact type `RELATIONSHIP_TOUCH` with meta `{ type, notes }` on the lead. No new table.
- **UI:** Lead detail section “Relationship touches” — list recent touches, button “Log touch” (type + notes).

### 8.3 Command Center

- “Relationship touches (this week)” count in Sales Leak card. Optional: list of leads with no touch in 30 days (later).

---

## 9. Presentation-overfocus warning (Phase 3)

- **Rule:** If in the past 7 days: (presentations or proposals sent) > X and (new contacts or first contacts) < target, show warning.
- **UI:** Small alert on Command Center or inside Sales Leak card: “You are over-indexing on presentation. Prospecting is the leak.”
- **Config:** X and target from operator settings (e.g. `presentationOverfocusThreshold`, `minNewContactsPerWeek`). Defaults: e.g. 3 presentations and 5 new contacts.

---

## 10. Weekly metrics to track (cash + discipline + leverage)

Suggested **weekly scorecard** (7 metrics max) for dashboard or export:

1. **Cash:** Revenue won (30d) or cash collected (from settings).
2. **Deals closed:** Won (90d).
3. **Pipeline value:** Estimate from qualified + sent (existing).
4. **Follow-up discipline:** % on-time or % with next date set.
5. **Referral asks:** Count this week or month.
6. **Referral leads:** New leads from referral this week.
7. **Sales leak:** This week’s worst leak stage (one line).

Store as artifact or in Pat/Tom-style weekly snapshot if you already have that pattern.

---

## 11. Implementation order (phased)

### Phase 1 (do first — highest money impact)

1. **Schema:** Add to Lead: `salesStage`, `nextContactAt`, `lastContactAt`, `followUpCount`, `followUpCadenceDays`, `permissionToFollowUp`, `personalDetails`. Migrate (e.g. `prisma db push` or migrate).
2. **PATCH allowlist:** Add new fields to `ALLOWED_PATCH_FIELDS` in `/api/leads/[id]/route.ts`.
3. **Sales Leak data:** Implement `getSalesLeakReport()` in `src/lib/ops/salesLeak.ts` using existing lead + artifact data; derive stage from status/timestamps when `salesStage` is null. Implement leak logic (worst drop-off or below target).
4. **Sales Leak card:** Add `SalesLeakCard.tsx`; fetch in Command Center page; place near top (e.g. under Money Scorecard).
5. **Lead detail:** Add “Sales stage” dropdown and “Next contact date” + “Last contact date” (and optional “Personal details”). Red note when next contact is missing for active stages.
6. **Follow-up discipline:** Implement `getFollowUpDisciplineScore()` in `src/lib/ops/followUpDiscipline.ts`; surface in Sales Leak card or small block.

### Phase 2

7. **Prospecting source:** Add `leadSourceType`, `leadSourceChannel`, `introducedBy` to Lead and allowlist. Lead form/detail: source dropdown and optional “Introduced by.”
8. **Referral tracking:** Add `referralAskStatus`, `referralAskAt`, `referralCount`, `referralNames` (or artifact). Endpoint or PATCH. On deal outcome “won,” show “Referral ask status” and optional prompt.
9. **Referral trigger:** When client-success has positive outcome and delivery complete, show “Best time to ask for referrals” in UI (no auto-send).
10. **Relationship touches:** Artifact type `RELATIONSHIP_TOUCH`; “Log touch” on lead detail; count in Sales Leak card.

### Phase 3

11. **Script library:** Script table or system artifact; mini “Scripts” panel by stage with one-click templates (copy to clipboard; human edits and sends).
12. **Presentation-overfocus warning:** Compare presentations vs new contacts in last 7 days; show alert if over-indexed. Use operator settings for thresholds.
13. **Weekly sales discipline score:** Add to weekly snapshot or Pat/Tom scorecard: follow-up %, referral asks, leak stage.

---

## 12. Guardrails for solo operator

- **No auto-send / no auto-build.** Scripts are templates only; human copies, edits, sends.
- **No cold outreach.** Source type and channel reflect warm / network / referral only.
- **Leak visibility first.** Don’t block; show “incomplete” and “leak” so operator fixes behavior.
- **Small reversible steps.** Each phase is shippable; new fields optional until you add validations.
- **Targets are guidance.** Operator can set weekly targets for new contacts and follow-ups; used only for leak message and overfocus warning, not enforcement.
- **Referral trigger is a prompt.** “Best time to ask” is a UI nudge, not an automated message.

---

## 13. File checklist (Phase 1)

| Item | Path |
|------|------|
| Schema | `prisma/schema.prisma` (add Lead fields) |
| Sales leak logic | `src/lib/ops/salesLeak.ts` (new) |
| Ops types | `src/lib/ops/types.ts` (extend SalesLeakReport or new type) |
| Sales Leak card | `src/components/dashboard/command/SalesLeakCard.tsx` (new) |
| Command Center page | `src/app/dashboard/command/page.tsx` (fetch + render SalesLeakCard) |
| Follow-up discipline | `src/lib/ops/followUpDiscipline.ts` (new) |
| Lead PATCH allowlist | `src/app/api/leads/[id]/route.ts` (add allowed fields) |
| Lead detail UI | `src/app/dashboard/leads/[id]/page.tsx` (sales stage, next/last contact, personal details, red “no next date”) |

---

## 14. Summary

This plan integrates PBD’s sales operating system into your app by:

1. **Sales Leak Detector** — top-level card showing stage counts and the single biggest leak this week.
2. **PBD 6 stages** — parallel to delivery pipeline; each lead has optional sales stage + next action.
3. **Prospecting source** — warm | network_referral and channel; no cold.
4. **Follow-up discipline** — next contact date (required for completeness), follow-up count, on-time %.
5. **Referral tracking and trigger** — after closed-won and positive outcome, prompt to ask for referrals; track ask status and count.
6. **Relationship touches** — log non-sales touches; count in leak card.
7. **Presentation warning** — alert when over-indexing on presentation vs prospecting.
8. **Script library** — one-click templates by stage (Phase 3).

All steps keep human in the loop, respect axioms (no cold outreach, no auto-send), and prefer small reversible changes with high ROI first (Phase 1).

---

## 15. Patrick-style weekly scorecard (7 metrics max)

Pin to top of dashboard or run weekly review:

| # | Metric | Source |
|---|--------|--------|
| 1 | **Cash collected** | Operator settings (manual entry). |
| 2 | **Deals won (90d)** | Lead.dealOutcome = 'won', updatedAt in last 90d. |
| 3 | **Pipeline value** | Qualified × 0.1 + Sent × 0.25 × avg deal size (existing). |
| 4 | **New contacts (7d)** | Leads created or first contact in last 7d. |
| 5 | **Follow-ups on time (%)** | Follow-up discipline score (due vs done). |
| 6 | **Referral asks (30d)** | referralAskStatus = 'asked', referralAskAt in last 30d. |
| 7 | **Leak this week** | Single line: “Leak = [stage] ([reason]).” |

Keep the scorecard to these 7 so it stays scannable and actionable. Optionally store a snapshot artifact each week (e.g. type `WEEKLY_SALES_SCORECARD`) for trend.
