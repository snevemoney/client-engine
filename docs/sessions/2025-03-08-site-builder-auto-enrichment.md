# Session: Site Builder Auto-Enrichment — 2025-03-08

## Goal

Implement automatic enrichment of builder payloads so websites are better without manual steps. Condense Prompts 1–3 (Architecture, Design System, Content) into a single LLM call that runs before every createSite + generateContent.

## Decisions Made

- **Single LLM call:** One Claude call produces scope, brandColors, contentHints, and clientInfo (hero, features, CTA, tone). Avoids 9 separate prompts.
- **Pack into contentHints:** Builder API unchanged. Hero, features, CTA packed as prose into contentHints so builder's AI can use it.
- **Fallback on error:** If enrichSiteBrief fails (LLM error, parse error), caller uses defaults. No blocking.
- **Integration points:** Flywheel and POST /api/delivery-projects/[id]/builder/create. Both call enrichSiteBrief before createSite.

## What Was Built

- Created `src/lib/builder/site-brief-prompt.ts` — Prompt template (condensed Prompts 1–3), SiteBriefContext type, buildSiteBriefPrompt()
- Created `src/lib/builder/enrich-site-brief.ts` — enrichSiteBrief(deliveryProjectId), packContentHintsForBuilder(), EnrichedSiteBriefSchema
- Modified `src/lib/orchestrator/flywheel.ts` — Call enrichSiteBrief before createSite; use enrichment for scope, brandColors, contentHints, tone
- Modified `src/app/api/delivery-projects/[id]/builder/create/route.ts` — Same enrichment flow; prefer enrichment when available
- Updated CHANGELOG.md, ARCHITECTURE.md

## Key Insights

- Positioning artifact meta (feltProblem, reframedOffer, blueOceanAngle, languageMap) is the main input for personalized copy.
- packContentHintsForBuilder merges base hints with hero/features/CTA so builder gets structured prose without API changes.
- TS5076: `||` and `??` cannot be mixed without parentheses — fixed with `(parts.join("\n\n") || baseHints) ?? ""`.

## Trade-offs Accepted

- Enrichment runs synchronously before createSite. Adds ~2–5s latency. Could be async in Phase 2.
- Regenerate route not enriched in Phase 1 (plan says Phase 2).

## Next Steps

- [ ] Phase 2: Add enrichment to regenerate flow
- [ ] Phase 3: Post-build QA (Prompt 9) as automated check
