# Production-Undeniable Sprint Plan

**Purpose:** Turn the operator app into an undeniable production layer: failures impossible to miss, results-first client view, reusable-asset habit, learning→action, chat with receipts, constraint evidence, and Cloud Agent safety. This doc is the implementation contract for Cursor Cloud Agent and human dev.

**Read first:** `docs/CLIENT_ENGINE_AXIOMS.md`, `PROJECT_CONTEXT.md`. No change may violate axioms (no auto-send, no auto-build, human approval gates, observational proof).

---

## Current state (what exists)

| Area | Exists | Gap |
|------|--------|-----|
| **Failures & Interventions** | `getFailuresAndInterventions()` + `FailuresInterventionsCard`: failed runs, stale leads (proposal sent >7d no outcome), stuck proposals (>5d), needs approval | Missing: last run status (fail/partial/success), stale by *touch* (no touch in X days), broken integrations, low-confidence AI, single *top-level* brutal panel |
| **Results / Client Success** | `ClientSuccessCard`, `ClientResultsGlance`, `/api/leads/[id]/client-success`, types: resultTarget, baseline, interventions, outcomeEntries, risks, feedback, reusableAssets | Results are a *section* on lead detail; plan wants *default results-first view* for active/shipped clients (target, baseline, current, delta, what worked/failed, proof artifact) |
| **Reusable Asset Log** | DB `ReusableAssetLog` (leadId, projectId, assetType, label, reasonNone, notes); API `GET/POST /api/leads/[id]/reusable-assets`; `ReusableAssetLogCard` on lead detail | Missing: “where stored”, reuse confidence (low/med/high), playbook as type; operator habit UX (explicit “extracted?” yes/no) |
| **Learning → Action** | Learning ingest, proposals, `promotedToPlaybook`, `producedAssetType` (proposal_template, case_study, automation, knowledge_only), PATCH learning proposal | Missing: classify (sales/ops/AI/delivery/positioning), confidence score, map to system, contradictions vs playbook, “promote to playbook?” flow, track-if-produced-improvement |
| **Chat** | `/api/ops/chat` with cite sources, “Inferring:”, “Data missing:”, brief/scorecard/constraint/queue/learning/ROI in context | Missing: explicit *receipts* block in response (Known / Inferred / Missing), and citation of results ledger, run status, proposal pipeline |
| **Constraint / Bottleneck** | `getConstraintSnapshot()`, `ConstraintCard` (reason + recommended actions) | Constraint has `evidence` object but UI does *not* show it; plan wants evidence trail (e.g. “4 leads stuck >7d”, “avg proposal cycle 2.1d→5.8d”, “win rate X→Y”) |
| **Build-to-Revenue (learning)** | `producedAssetType` on learning proposals | Plan wants full tag set: proposal improvement, outreach script, sales objection script, service package refinement, delivery SOP, QA checklist, automation, case study, nothing yet |
| **Service Package** | — | Not implemented. Need internal package definitions (name, promise, scope, exclusions, ideal client, steps, turnaround, revision policy, price/range, custom upgrades). |
| **Expectation management** | — | Not implemented. Per lead/proposal: client requested outcome, realistic range, risk flags, under/over-asking, “what they actually need”, expectation reset script. |
| **Offer ladder** | — | Not implemented. Per lead: offer type (DFY / productized / premium), why chosen, upgrade path, repeatability score. |
| **Cloud Agent** | `BuildTask` model + Build Ops queue + API | Missing: Job Ledger (task, files touched, branch, result, tests, human approval, deployed?), Change Risk Classifier, Template Factory registry. |

---

## Phase 1 — “No silent failure” + Results-first (highest ROI)

**Goal:** One brutal Failures & Interventions panel; results ledger as default client view.

### 1.1 Failures & Interventions (single top-level panel)

**Behavior to add:**

- **Last run status:** For each lead with pipeline runs, expose “last run status”: fail | partial | success (from `PipelineRun.success` + step success). Surface in failures data.
- **Stale by touch:** Leads with no touch in X days (e.g. 7). Use `LeadTouch` + `lastContactAt`; configurable threshold.
- **Broken integrations:** Placeholder: list of “integration health” (e.g. research run last 24h, knowledge ingest last 24h). If no run or error, one line in panel. (Can be stub “Research: last run 2h ago” from WORKDAY_RUN_REPORT or a small health table.)
- **Low-confidence AI:** If you have confidence on learning/knowledge suggestions, add “low-confidence recommendations” count to failures payload (optional Phase 1).
- **Approval queue:** Already have “needs approval”; keep and ensure it’s prominent.
- **Single panel:** Either (a) make `FailuresInterventionsCard` the *first* card on Command Center and expand it with the new buckets, or (b) add a dedicated `/dashboard/failures` page that is the full panel and have the card summarize + link to it.

**DB:** Optional: `IntegrationHealth` or use existing artifacts (e.g. last RESEARCH_RUN_REPORT timestamp). For “stale by touch”, no new table; derive from `LeadTouch` + `lastContactAt`.

**Files to touch:**

- `src/lib/ops/failuresInterventions.ts` — extend type and `getFailuresAndInterventions()`:
  - Add `lastRunStatusByLeadId` or include last run status in failed runs / a new “recent run status” list.
  - Add `staleByTouch: { leadId, leadTitle, daysSinceTouch }[]` (threshold e.g. 7 days).
  - Add `brokenIntegrations: { name, lastOkAt, message }[]` (stub or from run reports).
- `src/components/dashboard/command/FailuresInterventionsCard.tsx` — add sections for stale-by-touch, broken integrations; link to “View all” if using a full page.
- `src/app/dashboard/command/page.tsx` — move Failures & Interventions card to the top (first or second after header); optionally add link to `/dashboard/failures` if you add that route.

**Cursor task (copy/paste):**

```
Extend Failures & Interventions to a single top-level panel:
1. In getFailuresAndInterventions add: (a) last run status per lead (fail/partial/success), (b) stale leads by touch (no LeadTouch/lastContactAt in last 7 days), (c) brokenIntegrations array (stub: research last run from system artifact or env).
2. Update FailuresAndInterventions type and FailuresInterventionsCard to show these sections with clear labels and links to leads.
3. Place FailuresInterventionsCard at the top of the Command Center (first card after header). Do not change auto-send/auto-build logic.
```

---

### 1.2 Results Ledger as default client view

**Behavior:** For leads in APPROVED | BUILDING | SHIPPED, the *default* view when opening a lead should be results-first: target, baseline, current, delta, interventions, what worked/failed, proof artifact.

**Options:**

- **A)** Lead detail: make “Results” the first section (above status bar and sales stage), and expand it into a full “Results Ledger” block (target, baseline, current metric, delta, interventions list, outcome entries, “what worked / what failed”, proof artifact link/upload).
- **B)** New route `/dashboard/clients` or `/dashboard/results`: list of active/shipped clients; click → lead detail with results tab or results-first layout.

**DB:** Existing client-success API and types. Optional: add `proofArtifactId` or “proof artifact” reference to client-success payload if not already there.

**Files to touch:**

- `src/app/dashboard/leads/[id]/page.tsx` — reorder so for APPROVED/BUILDING/SHIPPED the first visible block is “Results Ledger” (expand ClientResultsGlance into a full card: target, baseline, current, delta, interventions, outcomes, what worked/failed, proof).
- `src/components/dashboard/leads/ClientResultsGlance.tsx` or new `ResultsLedgerCard.tsx` — full results view: target, baseline, current result, delta, interventions applied, outcome entries, “what worked / what failed” (could be a text field or list in client-success), proof artifact (link or list).
- `src/lib/client-success/types.ts` — add if missing: `currentResult`, `delta`, `whatWorked`, `whatFailed`, `proofArtifactIds` (or single).
- `src/app/api/leads/[id]/client-success/route.ts` — ensure GET returns and POST accepts these fields (may already be in artifact meta).

**Cursor task:**

```
Make Results Ledger the default client view for APPROVED/BUILDING/SHIPPED leads:
1. Add or extend client-success types: currentResult, delta, whatWorked, whatFailed, proofArtifactId(s). Ensure API reads/writes these.
2. Create ResultsLedgerCard (or expand ClientResultsGlance): show target, baseline, current, delta, interventions, outcome entries, what worked/failed, proof artifact. Place it as the first section on lead detail for APPROVED/BUILDING/SHIPPED.
3. Do not remove existing Client Success card; keep it as the edit/entry point. Results Ledger is the read-first view.
```

---

## Phase 2 — Reusable Asset + Learning→Action + Chat receipts

### 2.1 Reusable Asset Log (explicit per project)

**Behavior:**

- “Reusable asset extracted?” yes/no (already partly there with “none” + reason).
- Type: template | component | prompt | workflow | checklist | playbook | case_study (add prompt, playbook; align with plan).
- “Where stored” (e.g. URL, path, or “Notion doc X”).
- Reuse confidence: low | medium | high.

**DB:**

- `ReusableAssetLog`: add `whereStored: String?`, `reuseConfidence: String?` (low/medium/high). Add enum or string for assetType including `prompt`, `playbook`.

**Files:**

- `prisma/schema.prisma` — add columns to `ReusableAssetLog`.
- `src/app/api/leads/[id]/reusable-assets/route.ts` — accept/return whereStored, reuseConfidence; allow assetType prompt, playbook.
- `src/components/dashboard/leads/ReusableAssetLogCard.tsx` — add “Where stored?”, “Reuse confidence” (dropdown); “Extracted?” yes/no prominent; type dropdown with full list.

**Cursor task:**

```
Reusable Asset Log: add whereStored and reuseConfidence; add asset types prompt and playbook. Update ReusableAssetLogCard with explicit 'Extracted? yes/no', where stored field, and reuse confidence (low/med/high). Keep human-driven only.
```

---

### 2.2 Learning → Action (Promote to Playbook + contradictions)

**Behavior:**

- On learning proposal: classify (sales | ops | AI | delivery | positioning).
- Confidence score (e.g. 0–1 or low/med/high).
- “Contradictions vs existing playbook” (text or list); show in UI.
- “Promote to playbook?” yes/no (you have this); make it a clear UX step.
- “Produced:” tag set: proposal improvement, outreach script, sales objection script, service package refinement, delivery SOP, QA checklist, automation, case study, nothing yet (knowledge-only).

**DB:**

- Learning proposal artifact meta: add `classification`, `confidence`, `contradictionsWithPlaybook`, and extend `producedAssetType` to the full list above (or a new field `producedTag`).

**Files:**

- `src/lib/learning/types.ts` — extend proposal meta type.
- `src/app/api/learning/proposal/[artifactId]/route.ts` — PATCH accepts classification, confidence, contradictionsWithPlaybook, producedTag (or expanded producedAssetType).
- `src/components/dashboard/learning/LearningPageClient.tsx` — add classify dropdown, confidence, contradictions display/edit, “Promote to playbook?” step, and “Produced” dropdown with full tag list.

**Cursor task:**

```
Learning → Action: add to learning proposal meta classification (sales/ops/AI/delivery/positioning), confidence, contradictionsWithPlaybook. Add 'Produced' dropdown with: proposal improvement, outreach script, sales objection script, service package refinement, delivery SOP, QA checklist, automation, case study, nothing yet. Expose in LearningPageClient with clear Promote to playbook? and Contradictions UI. Do not auto-promote; human only.
```

---

### 2.3 Chat with receipts (evidence + uncertainty)

**Behavior:** Every chat answer should end (or include) a structured block:

- **Known:** facts taken directly from data (with source name).
- **Inferred:** conclusions not directly in the data.
- **Missing data:** what would be needed to answer more fully.

And cite: today’s brief, scorecard, constraint snapshot, run status, proposal pipeline, results ledger, playbook/transcript insight when used.

**Files:**

- `src/app/api/ops/chat/route.ts` — ensure context includes: brief, money scorecard, constraint, queue, learning/ROI, and add results ledger summary (e.g. active clients with result target/outcome) and run status summary. In the system prompt, require the model to end with a “Receipts” block: Known / Inferred / Missing data. Optionally parse the response and attach a structured `receipts: { known, inferred, missing }` in JSON in the reply.

**Cursor task:**

```
Chat with receipts: Update ops chat to include in context results ledger summary and run status. In system prompt require a final 'Receipts' block: Known (facts + source), Inferred, Missing data. Ensure citations mention: brief, scorecard, constraint, queue, proposal pipeline, results ledger, learning/playbook when used.
```

---

### 2.4 Constraint / Bottleneck with evidence

**Behavior:** When the app says “bottleneck = proposal stage”, show evidence: e.g. “4 leads stuck >7d”, “avg proposal cycle 2.1d → 5.8d”, “2 approvals pending”, “win rate X → Y”.

**DB:** Constraint snapshot already has `evidence` object; no schema change if evidence is structured.

**Files:**

- `src/lib/ops/constraint.ts` — ensure `evidence` for each candidate includes counts and, where possible, deltas (e.g. avg days in stage this week vs last). If not already computed, add pipeline-stage timing (e.g. from artifact createdAt or lead timestamps) to compute “avg proposal cycle” and “leads stuck >7d”.
- `src/components/dashboard/command/ConstraintCard.tsx` — render `constraint.evidence` (e.g. bullet list with numbers and short labels). Add link to metrics.

**Cursor task:**

```
Constraint with evidence: In ConstraintCard display constraint.evidence (counts, deltas). In getConstraintSnapshot ensure evidence includes e.g. leadsStuckCount, avgProposalCycleDays, approvalsPending, winRateDelta where data exists. No new tables; use existing pipeline/lead/artifact data.
```

---

## Phase 3 — Service Packages, Expectation management, Offer ladder

### 3.1 Service Package system (internal)

**DB:**

- New model `ServicePackage`: name, promiseOutcome, scopeIncluded (text), exclusions (text), idealClient (text), deliverySteps (text or JSON array), turnaroundTarget (string), revisionPolicy (string), basePriceMin, basePriceMax, customUpgradeOptions (JSON or text). No client-facing API yet.

**API:** `GET/POST/PATCH /api/service-packages` (auth only). List + CRUD.

**UI:** `/dashboard/settings` or `/dashboard/packages`: list packages, add/edit form (name, promise, scope, exclusions, ideal client, steps, turnaround, revision policy, price range, custom upgrades). Optional: on lead detail, “Link to package” dropdown.

**Cursor task:**

```
Add ServicePackage model (name, promiseOutcome, scopeIncluded, exclusions, idealClient, deliverySteps, turnaroundTarget, revisionPolicy, basePriceMin, basePriceMax, customUpgradeOptions). Add API GET/POST/PATCH /api/service-packages and a simple UI section under Settings or new Packages page. Internal use only; no client-facing exposure.
```

---

### 3.2 Expectation management (per lead/proposal)

**DB:**

- Either extend `Lead` or add artifact type `EXPECTATION_SNAPSHOT` with meta: clientRequestedOutcome, realisticOutcomeRange, riskFlags[], underAskingFlag, overAskingFlag, whatTheyActuallyNeedRecommendation, expectationResetScript (talking points).

**API:** If artifact-based: POST/GET via artifacts on lead. If lead meta: PATCH lead with allowlisted expectation fields.

**UI:** On lead detail (or proposal console), section “Expectation management”: client requested outcome, realistic range, risk flags (tags), under/over-asking toggles, “What they actually need” text, expectation reset script. Human-only.

**Cursor task:**

```
Expectation management: Add artifact type EXPECTATION_SNAPSHOT or extend lead meta with clientRequestedOutcome, realisticOutcomeRange, riskFlags, underAskingFlag, overAskingFlag, whatTheyActuallyNeed, expectationResetScript. Add API and a section on lead detail for editing. Human-only; no auto-send.
```

---

### 3.3 Offer ladder (per lead)

**DB:**

- Add to `Lead` or artifact: offerType (enum: fast_cash_dfy | productized | premium_custom_system), offerChosenReason (text), upgradePath (text), repeatabilityScore (number or enum).

**API:** PATCH lead or artifact.

**UI:** Lead detail: “Offer type” dropdown, “Why this offer”, “Upgrade path”, “Repeatability score”. Optional list view filter by offer type.

**Cursor task:**

```
Offer ladder: Add offerType (fast_cash_dfy / productized / premium_custom_system), offerChosenReason, upgradePath, repeatabilityScore to Lead or lead artifact. Expose on lead detail with dropdown and short text fields. Optional: filter leads by offer type on leads list.
```

---

## Phase 4 — Cloud Agent safety and Template Factory

### 4.1 Cloud Agent Job Ledger

**Behavior:** Track every Cloud Agent run: task requested, files touched, branch, result, tests passed/failed, human approval status, deployed (yes/no).

**DB:**

- New model `CloudAgentJob`: buildTaskId (optional), taskRequested (text), filesTouched (string[]), branch (string), result (success | failure | partial), testsPassed (boolean?), testsFailed (boolean?), humanApproved (boolean), deployedAt (datetime?). createdAt.

**API:** POST from Cloud Agent (or manual) to record job; GET list with filters. PATCH to set humanApproved, deployedAt.

**UI:** Build Ops page or new “Agent runs” tab: table of jobs with task, files, branch, result, tests, approval, deployed. Link to BuildTask if buildTaskId set.

**Cursor task:**

```
Cloud Agent Job Ledger: Add CloudAgentJob model (buildTaskId, taskRequested, filesTouched[], branch, result, testsPassed, testsFailed, humanApproved, deployedAt). Add POST/GET/PATCH API and a table on Build Ops or new Agent runs section. Human sets approval and deployed; no auto-deploy.
```

---

### 4.2 Change Risk Classifier

**Behavior:** Before applying Cloud Agent edits, classify change risk: UI only | feature logic | pipeline logic | money-sensitive | auth/security | infra. High-risk → review required; low-risk → can auto-prepare patch.

**Implementation:** Can be convention-based first: when creating a BuildTask, operator or agent sets `riskLevel` (low | medium | high). Optionally infer from file paths (e.g. `src/app/api/build/` → money-sensitive). Enforce: high-risk tasks require humanApproved before merge.

**DB:** Add `riskLevel` to `BuildTask` (optional). Or add to `CloudAgentJob` when recording.

**UI:** Build task form: “Risk level” dropdown. Build Ops list: show risk; filter “needs review” for high-risk.

**Cursor task:**

```
Change Risk: Add riskLevel (low/medium/high) to BuildTask. In Build Ops UI show risk and require human approval for high-risk before marking done. Optionally infer risk from file paths in CloudAgentJob and store on job. No auto-merge for high-risk.
```

---

### 4.3 Template Factory / Starter Codebase Registry

**DB:**

- New model `TemplateStarter`: name, nicheUseCase, stack (string[]), status (draft | tested | proven), clientLeadIds (string[]), resultsProduced (text), reusableModulesInside (text or JSON). createdAt.

**API:** GET/POST/PATCH /api/template-starters. List by niche, stack, status.

**UI:** New page `/dashboard/templates` or section under Build Ops: list templates, add/edit (name, niche, stack, status, which clients used, results, reusable modules). Link to leads.

**Cursor task:**

```
Template Factory: Add TemplateStarter model (name, nicheUseCase, stack[], status, clientLeadIds[], resultsProduced, reusableModulesInside). Add API and /dashboard/templates page (or section) to list and edit. Link clients used to lead IDs. Human-only.
```

---

## Priority order (implementation sequence)

1. **Phase 1.1** — Failures & Interventions panel (single top-level, stale-by-touch, last run status, integrations stub).
2. **Phase 1.2** — Results Ledger as default client view.
3. **Phase 2.1** — Reusable Asset Log (where stored, confidence, types).
4. **Phase 2.2** — Learning → Action (classify, confidence, contradictions, produced tags).
5. **Phase 2.3** — Chat with receipts.
6. **Phase 2.4** — Constraint with evidence.
7. **Phase 3** — Service Packages, Expectation management, Offer ladder (can be parallel).
8. **Phase 4** — Cloud Agent Job Ledger, Risk classifier, Template Factory.

---

## Cursor Cloud Agent usage

- Use **Build Ops Queue** to create tasks for each item above (one task per Cursor task block).
- Set **business impact** on each task: Acquire / Deliver / Improve.
- After each run: update BuildTask with `prSummary`, set status to `review`, then `humanApproved` after review. Optionally log to Cloud Agent Job Ledger when that exists.
- Do not change: money-path gates, auto-send, auto-build, or axiom-forbidden behavior.

---

## Success criteria (Pat + Tom)

- **Patrick:** “Where does it make money every week?” — Results Ledger and Reusable Asset Log must tie to client outcomes and future product; Service Packages and Offer ladder must support selling and repeatability.
- **Tom:** “Failures impossible to miss; feedback loop updates operations.” — Failures & Interventions is the first thing on Command Center; constraint shows evidence; learning has promote-to-playbook and produced tags; chat cites sources and receipts.
