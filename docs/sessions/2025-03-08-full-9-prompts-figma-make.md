# Session: Full 9-Prompts + Figma Make — 2025-03-08

## Goal

Implement full 9-prompts spec and Figma Make integration so websites are no longer generic. Use Prompts 4–9 (component logic, Figma Make, animation, responsive, data, QA) in addition to existing 1–3.

## Decisions Made

- **Single LLM call with expanded schema** — One Claude call produces scope, brandColors, contentHints, clientInfo, designSystem, componentLogic, figmaMakePrompts (5), animationSpecs, responsiveSpecs, dataIntegration, qaChecklist. max_tokens increased to 4096.
- **Figma Make has no API** — Generate 5 prompts and a direct link to Figma Make with first prompt pre-filled via `figmakeInitialMessage` URL param. Operator pastes or opens link.
- **Builder receives full spec** — designSystem, componentLogic, animationSpecs, responsiveSpecs, qaChecklist passed to generate route and injected into prompt.
- **Custom theme from brandColors** — Site-builder stores themeColorsJson; getTheme() uses custom colors when provided. Map 4 hex to heroFrom, heroTo, primary, accent.

## What Was Built

### Client Engine
- `src/lib/builder/site-brief-9-prompts.ts` — Full 9-prompts prompt (architecture, design system, content, component logic, Figma Make, animation, responsive, data, QA)
- `src/lib/builder/enrich-site-brief.ts` — Extended schema, uses buildSiteBrief9Prompt, max_tokens 4096
- `src/lib/builder/client.ts` — GenerateContentInput extended with designSystem, componentLogic, animationSpecs, responsiveSpecs, qaChecklist
- `src/app/api/delivery-projects/[id]/builder/figma-make-prompts/route.ts` — GET returns 5 prompts + figmaMakeUrl
- `src/app/api/delivery-projects/[id]/builder/create/route.ts` — Pass designSystem, componentLogic, animationSpecs, responsiveSpecs, qaChecklist
- `src/app/api/delivery-projects/[id]/builder/regenerate/route.ts` — Same
- `src/app/dashboard/delivery/[id]/page.tsx` — "Figma Make prompts" button, collapsible panel with 5 prompts + copy + Open in Figma Make link

### Site Builder
- `prisma/schema.prisma` — themeColorsJson on Site
- `src/lib/themes/index.ts` — getTheme(industry, customColors), adjustBrightness helper
- `src/app/api/sites/route.ts` — Store themeColorsJson from body.brandColors
- `src/app/api/sites/[id]/generate/route.ts` — Use designSystem, componentLogic, animationSpecs, responsiveSpecs, qaChecklist in context blocks
- `src/app/preview/[id]/page.tsx`, `site/[slug]/page.tsx`, `sites/[id]/admin/page.tsx` — Pass customColors to getTheme

## Key Insights

- Figma Make URL: `https://www.figma.com/make/new?figmakeInitialMessage=ENCODED_PROMPT`. URL length limit ~2k; truncate prompt if needed.
- Enrichment runs on every create/regenerate; Figma Make prompts API re-runs enrichSiteBrief (no persistence of enrichment).
- Custom theme: 4 hex → primary, heroFrom, heroTo, accent. Derive primaryHover, primaryLight via adjustBrightness.

## Trade-offs Accepted

- Full 9-prompts in one call adds latency (~5–15s). Could split into 2 calls (core + Figma Make) in future.
- Figma Make is manual workflow: operator copies prompts or opens link. No programmatic design generation.

## Next Steps

- [ ] Validate LLM output quality for figmaMakePrompts (5 strings, client-specific)
- [ ] Consider caching enrichment for Figma Make API to avoid re-run
- [ ] Phase 3: Post-build QA (Prompt 9) as automated check in quality-check.ts
