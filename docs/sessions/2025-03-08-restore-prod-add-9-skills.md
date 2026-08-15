# Session: Restore Prod + Add 9 Skills — 2025-03-08

## Goal
Restore dev to production behavior (fix broken regenerate flow) and properly integrate the 9 skills so frontends improve. Client Engine runs enrichment and passes full clientInfo to the builder; no enrichContextUrl.

## Decisions Made
- **Regenerate flow**: Revert to prod pattern — fetch artifacts from DB, run enrichSiteBrief in Client Engine, merge artifact + enrichment into clientInfo. Remove enrichContextUrl/deliveryProjectId (builder scaffold doesn't support them).
- **9 skills location**: Keep in Client Engine at `src/lib/builder/skills/`. Builder receives output in clientInfo.
- **proposalContent**: Change from "use verbatim for hero" to "for context only; use description, felt problem, reframed offer for hero" — proposal is scope of work, not client-facing copy.
- **brandColors fallback**: Regenerate, create, and flywheel all use getFallbackBrandColors when enrichment has no brandColors.
- **Quality check**: Pass full genInput to checkAndReactToQuality so auto-regenerate uses rich context.

## What Was Built
- **`src/app/api/delivery-projects/[id]/builder/regenerate/route.ts`** — Restored prod flow: fetch artifacts, run enrichSiteBrief, merge into clientInfo, pass brandColors (enrichment or fallback). Full genInput to quality check. Try/catch for builder failures (502).
- **`src/lib/builder/enrich-site-brief-9phases.ts`** — Fixed proposalContent instruction: no longer "use verbatim for hero".
- **`src/lib/orchestrator/flywheel.ts`** — Added getFallbackBrandColors when enrichment has no brandColors. Use effectiveBrandColors in createSite and genInput.

## Key Insights
- Builder scaffold (`./builder`) does not support enrichContextUrl — it ignores those fields. Dev regenerate was passing minimal clientInfo when no feedback, producing generic output.
- Prod create/regenerate never used enrichSiteBrief; they built clientInfo from artifacts only. Adding enrichSiteBrief augments with 9-phase design spec without changing the flow.

## Trade-offs Accepted
- enrich-context route kept for SBP/future use; regenerate does not use it.
- deliveryProjectId/enrichContextUrl remain in GenerateContentInput type for potential site-builder repo support.

## Next Steps
- [ ] Verify regenerate end-to-end: create delivery project with builder site, click Regenerate, confirm client-specific content and varied colors.
- [ ] Run `npx playwright test tests/e2e/builder-9-phases.spec.ts` if applicable.
