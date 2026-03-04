# Session: Sprint 8 — Proof Autopublish + Campaign Pages (2026-03-04)

## Goal
Implement proof autopublish (draft on paid) and campaign pages per the design review plan.

## Decisions Made
- Proof fields on Project (not separate Proof model) — keeps portfolio layer simple
- Campaign aggregates by filterTag matching project campaignTags (case-insensitive at write)
- Proof generation fires only on paymentStatus transition to paid (idempotent)
- buildProposalPrompt extended with optional proofLinks; getProofLinks scores by tech stack overlap

## What Was Built

### Schema
- Project: proofPublishedAt, proofHeadline, proofSummary, proofTestimonial, campaignTags
- Campaign: slug, title, filterTag, published, ctaLabel, ctaUrl

### Proof
- `src/lib/proof/generate.ts` — generateProofDraft(projectId), OpenAI with PROOF_GENERATION_RULES (Axioms §8)
- Hook in PATCH /api/projects/[id] when paymentStatus → paid
- Public `/proof/[slug]` — OG meta, tech badges, screenshots, summary, testimonial, CTA
- ProofEditor component in deploys table (expandable row)

### Campaigns
- GET/POST /api/campaigns, GET/PATCH/DELETE /api/campaigns/[id]
- Public `/campaigns/[slug]` — aggregates projects by campaignTags.has(filterTag)
- Campaign manager at /dashboard/campaigns
- Sidebar: Campaigns (Megaphone) in Prove group

### Outreach
- `src/lib/proof/getProofLinks.ts` — top 3 proof pages by tech stack overlap
- buildProposalPrompt(lead, positioningBrief, { proofLinks })
- runPropose calls getProofLinks and passes to buildProposalPrompt

## Key Insights
- campaignTags/filterTag matching uses Prisma `has` for array containment
- Proof generation is fire-and-forget; operator can refresh to see draft

## Next Steps
- Sprint 9: Outcome Ledger + Scorecard
