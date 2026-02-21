# System map — Acquire / Deliver / Improve

Every module in the app serves one of three buckets. If a page or feature doesn’t serve one of these, it lives in “Advanced” or is documentation.

---

## Acquire

**Goal:** Get leads and move them toward proposal and approval.

| Input | Process | Output |
|-------|---------|--------|
| Inbound leads (site, research, email) | Capture → Enrich → Score → Position → Propose | Qualified opportunities, proposals ready for review |
| Research feed (RSS/Atom) | Filter, dedupe, create lead, run pipeline | New leads with enrichment and proposals |
| Follow-up queue | 5-touch sequence (manual send) | Stale opportunities re-engaged |

**Key surfaces:** Lead capture form, Leads table, Proposals workspace, Research run, Follow-up queue.  
**Metrics:** New leads, qualified count, proposals sent, pipeline value estimate.

---

## Deliver

**Goal:** Turn approved work into client results and proof.

| Input | Process | Output |
|-------|---------|--------|
| Approved lead + proposal | Build (manual), delivery | Project / shipped work |
| Result target, baseline | Interventions, outcome scorecard, risk log | Client outcomes, proof posts |
| Reusable assets | Log per project (template, component, playbook, case study) | Future leverage |

**Key surfaces:** Lead detail (approve/build), Client Success card, Result target, Baseline, Interventions, Outcome scorecard, Reusable assets, Proof & Checklist.  
**Metrics:** Builds completed, client outcome entries, proof posts generated.

---

## Improve

**Goal:** Make the system better without breaking the money path.

| Input | Process | Output |
|-------|---------|--------|
| YouTube transcripts | Ingest → summarize → extract principles → improvement proposal | Learning summaries, proposals (human approve before apply) |
| Improvement proposals | Promote to playbook, tag produced asset (template/case study/automation/knowledge only) | Curated playbook, build-to-revenue traceability |
| Knowledge queue | Suggestions from transcripts, human review | Applied improvements |
| Feedback notes, failures | Brief, constraint, Failures & Interventions card | Next actions, bottleneck visibility |

**Key surfaces:** Learning (ingest, proposals, promote/produced tag), Knowledge, Command Center (Failures & Interventions, Constraint, Brief Me), Operator chat (evidence-first, cite sources).  
**Metrics:** Proposals promoted, produced asset type, run status, constraint evidence.

---

## Feedback loop

- **Acquire → Deliver:** Which lead sources and proposal formats convert. Pipeline leak report, stage conversion.
- **Deliver → Improve:** Client feedback, outcome scorecard, reusable assets. Proof posts feed positioning and proposals.
- **Improve → Acquire/Deliver:** Playbook and learning proposals (once promoted) inform positioning, prompts, and next actions. Chat and brief cite scorecard, constraint, queue.

---

## Human-only (never automated)

- Final proposal send  
- Build start  
- Positioning / offer changes  
- Approve / reject lead  

Automation runs research and pipeline only. Money-path steps always require operator approval.
