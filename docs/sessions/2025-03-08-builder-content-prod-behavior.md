# Session: Builder Content — Prod Behavior — 2025-03-08

## Goal
Fix generated site content that showed proposal/scope text and design specs instead of client-facing copy. Dev output looked like internal analysis; prod should show benefit-focused hero and marketing sections.

## Problem
- Hero: "Your Squarespace Site Lacks Continuity and SEO Optimization — And It's Affecting Your Visibility" (proposal scope)
- Sections: Design spec text (H1: 48px, 8px grid, WCAG) or proposal scope as body copy
- Expected: "Refresh Your Squarespace Site Without Starting Over" (client-facing, benefit-focused)

## Root Cause
1. **contentHints/bio** — Regenerate passed full enrichment artifact (1500 chars) as baseHints; LLM treated proposal text as content to output
2. **Builder prompt** — Design spec was "APPLY ALL"; LLM interpreted as "include in output" rather than layout guidance
3. **Hero instruction** — site-brief-9 said "copy verbatim from proposal"; proposal scope is internal, not client-facing

## Changes Made

### Builder generate route (`builder/src/app/api/sites/[id]/generate/route.ts`)
- Renamed context section: "layout/design guidance only. Do NOT output this text as section body content"
- Added CRITICAL RULES: section content MUST be client-facing marketing copy; NOT proposal, design specs, or typography
- Explicit props shape: `{ "title": "...", "body": "..." }` for sections

### Regenerate route (`src/app/api/delivery-projects/[id]/builder/regenerate/route.ts`)
- baseHints: use short business summary (lead.description or project.summary, 400 chars) — NOT enrichArtifact.content
- Avoids dumping proposal/scope into bio

### site-brief-9 (`src/lib/builder/site-brief-9.ts`)
- Hero: benefit-focused from description/reframed offer; NOT proposal scope
- FORBIDDEN: "Your X lacks", "And It's Affecting", proposal-style language
- Proposal: "for context only — do NOT use verbatim for hero"

### enrich-site-brief (`src/lib/builder/enrich-site-brief.ts`)
- Restored 9-phase imports (was broken after slim attempt)
- Anti-generic retry: prefer reframed offer/description over proposalContent

## Key Insights
- The builder receives bio + design spec. If bio contains proposal text, the LLM outputs it as section content
- Design spec (typography, spacing) is for layout; LLM was outputting it as section body
- Hero from proposal scope sounds like internal analysis; hero from reframed offer/description sounds like value prop

## Follow-up (2025-03-08 continued)
- **Layout** — Section editor forms (Hero, About, Services, etc.) moved above the Regenerate button and action bar in `src/app/dashboard/delivery/[id]/page.tsx` for clearer editing flow.

## Next Steps
- [ ] Verify regenerate end-to-end: create/regenerate site, confirm client-facing hero and sections
- [ ] Consider same contentHints fix for create/flywheel when they use enrichment path
