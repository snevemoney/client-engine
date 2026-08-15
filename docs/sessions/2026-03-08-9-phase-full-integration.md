# Session: 9-Phase Full Integration — 2026-03-08

## Goal
Implement the Full 9-Phase Integration Plan: move enrichment to site-builder, extend Phase 2 schema, add parsers, and apply all phase outputs in components.

## Decisions Made
- **Phases in site-builder** — Enrichment runs in site-builder; Client Engine exposes enrich-context API. Site-builder fetches context and runs 9 phases internally. Single source of truth for design spec.
- **Auth** — enrich-context accepts Bearer ENRICH_CONTEXT_SECRET or AGENT_CRON_SECRET or session.
- **Regenerate** — Stops running enrichSiteBrief locally; calls generate with deliveryProjectId + enrichContextUrl.
- **Create flow** — Left unchanged for now; still runs enrichSiteBrief in Client Engine. Can be updated later to use enrichment path.

## What Was Built

### Client Engine
- **`src/app/api/internal/delivery-projects/[id]/enrich-context/route.ts`** — New GET route returning project, lead, proposal, artifacts, siteBriefContext for site-builder enrichment.
- **`src/app/api/delivery-projects/[id]/builder/regenerate/route.ts`** — Removed enrichSiteBrief; now calls generateContent with deliveryProjectId, enrichContextUrl. Passes client feedback in clientInfo.bio when present.
- **`src/lib/builder/client.ts`** — Added deliveryProjectId, enrichContextUrl to GenerateContentInput; clientInfo optional.
- **`.env.example`** — Documented ENRICH_CONTEXT_SECRET.

### Site-Builder
- **`src/lib/enrichment/`** — New module: runEnrichment, enrich-site-brief-9phases, types, llm, safe-parse-json, site-brief-prompt, site-brief-9. Copied 9 skills from Client Engine.
- **`src/app/api/sites/[id]/generate/route.ts`** — When deliveryProjectId + enrichContextUrl present, fetches context from Client Engine, runs runEnrichment, uses result as clientInfo. Merges feedback bio.
- **`src/lib/sections/design-spec.ts`** — Extended with fontDisplay, fontBody, radiusScale, shadowScale; added getFontFamily, getRadius, getShadow, getComponentLogicHints, getDataIntegrationHints, getFigmaMood, getRadiusWithMood.
- **`src/app/layout.tsx`** — Pre-loads Inter, Playfair Display, DM Sans, Source Sans 3, Lora, Merriweather via next/font.
- **`src/app/preview/[id]/page.tsx`** — Applies fontFamily from getFontFamily; sets --font-display; viewport, themeColor in metadata.
- **`src/lib/sections/components.tsx`** — Uses getRadius, getShadow, getRadiusWithMood, getComponentLogicHints, getDataIntegrationHints, getFigmaMood. BookingSection multi-step when componentLogic includes "multi-step". ContactSection shows "Book a call" when dataIntegration mentions calendar. Font display on headings.
- **Phase 2 schema** — fontDisplay, fontBody, radiusScale, shadowScale in enrich-site-brief-9phases and types.
- **design-system-generator skill** — Added Site Builder Integration block with font/radius/shadow format.

## Key Insights
- Site-builder needs zod for enrichment; added as dependency.
- Regex `s` flag (dotall) requires ES2018+; used `[\s\S]` instead for shadow parser.
- Font variables from next/font are applied to html; getFontFamily returns var(--font-*) for known fonts.

## Trade-offs Accepted
- Create flow still runs enrichSiteBrief in Client Engine; only regenerate uses the new path. Create can be updated when site-builder is the single enrichment source.
- Multi-step booking form is a simplified 3-step UI (name/email → date/time → CTA); not wired to backend.

## Next Steps
- [x] Set ENRICH_CONTEXT_SECRET in both Client Engine and site-builder .env for local dev.
- [x] Regenerate 500 fix — Error handling added; builder failures return 502 with message (see 2026-03-08-regenerate-500-fix.md).
- [ ] Update builder/create to use enrichment path (fetch scope from enrich-context or run Phase 1 in site-builder create).
- [ ] E2E test for regenerate with enrichment path.
