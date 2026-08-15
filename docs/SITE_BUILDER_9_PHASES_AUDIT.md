# 9-Phase Implementation Audit

Verification that all 9 phases flow end-to-end: Enrichment → Create/Regenerate → Builder Generate.

## Phase-by-Phase Trace

| Phase | Output | Enrichment Schema | Enrichment Prompt | Create Passes | Regenerate Passes | Client Type | Builder Uses |
|-------|--------|-------------------|-------------------|---------------|-------------------|-------------|--------------|
| **1. Architecture** | scope, siteMap, userFlows | ✓ | ✓ MANDATORY | ✓ scope→sections, siteMap, userFlows | ✓ | ✓ siteMap, userFlows | ✓ [Phase 1] contextBlocks |
| **2. Design System** | brandColors, designSystem | ✓ | ✓ MANDATORY | ✓ brandColors→createSite, designSystem→clientInfo | ✓ | ✓ designSystem | ✓ [Phase 2] typography, spacing, layout, animationGuidelines, wcagNotes |
| **3. Content** | clientInfo (hero, features, testimonials, faq, footer, tone) | ✓ | ✓ MANDATORY | ✓ all | ✓ | ✓ all | ✓ MANDATORY blocks + contextBlocks |
| **4. Component Logic** | componentLogic | ✓ | ✓ MANDATORY | ✓ | ✓ | ✓ | ✓ [Phase 4] contextBlock |
| **5. Figma Make** | figmaMakePrompts (5) | ✓ | ✓ MANDATORY | ✓ first→figmaMakeDesignIntent | ✓ | ✓ figmaMakeDesignIntent | ✓ [Phase 5] Design intent |
| **6. Animation** | animationSpecs | ✓ | ✓ MANDATORY | ✓ | ✓ | ✓ | ✓ [Phase 6] contextBlock |
| **7. Responsive** | responsiveSpecs | ✓ | ✓ MANDATORY | ✓ | ✓ | ✓ | ✓ [Phase 7] contextBlock |
| **8. Data Integration** | dataIntegration | ✓ | ✓ MANDATORY | ✓ | ✓ | ✓ | ✓ [Phase 8] contextBlock |
| **9. QA** | qaChecklist | ✓ | ✓ MANDATORY | ✓ | ✓ | ✓ | ✓ [Phase 9] contextBlock |

## File References

- **Enrichment:** `src/lib/builder/site-brief-9.ts` (prompt), `src/lib/builder/enrich-site-brief.ts` (schema, fetch)
- **Create:** `src/app/api/delivery-projects/[id]/builder/create/route.ts` (genInput.clientInfo)
- **Regenerate:** `src/app/api/delivery-projects/[id]/builder/regenerate/route.ts` (clientInfo)
- **Client type:** `src/lib/builder/client.ts` (GenerateContentInput)
- **Builder generate:** `site-builder/src/app/api/sites/[id]/generate/route.ts` (contextBlocks, basePrompt)

## Playwright Verification

`tests/e2e/builder-9-phases.spec.ts` creates lead → proposal → delivery project, calls `GET /api/internal/test/builder-gen-input?projectId=xxx`, and asserts `genInput.clientInfo` contains all 9 phase keys. Run:

```bash
npx playwright test tests/e2e/builder-9-phases.spec.ts
```

## Fix Applied (2025-03-08)

**Phase 5 was missing:** figmaMakePrompts was produced by enrichment but never passed to the builder. Added:
- `figmaMakeDesignIntent` (first figmaMakePrompt) to GenerateContentInput
- Pass from create/regenerate: `enrichment?.figmaMakePrompts?.[0]`
- Builder contextBlock: `[Phase 5] Design intent`
- Builder 9-PHASE SPEC header now lists all 9 phases including Figma Make
