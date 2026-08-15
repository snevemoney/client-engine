# Full 9-Phase Implementation Audit

**Date:** 2025-03-08  
**Verified by:** Playwright E2E + code trace

---

## 1. Enrichment (site-brief-9.ts + enrich-site-brief.ts)

### Schema (EnrichedSiteBriefSchema)
| Phase | Field | Schema | ✓ |
|-------|-------|--------|---|
| 1 | scope | `z.array(z.string()).min(1)` | ✓ |
| 1 | siteMap | `z.string().optional()` | ✓ |
| 1 | userFlows | `z.string().optional()` | ✓ |
| 2 | brandColors | `z.array(z.string()).optional()` | ✓ |
| 2 | designSystem | object (typographyScale, spacingSystem, layoutPatterns, animationGuidelines, wcagNotes) | ✓ |
| 3 | clientInfo | heroHeadline, heroSubhead, ctaPrimary, features, testimonials, faq, footerTagline, tone | ✓ |
| 4 | componentLogic | `z.string().optional()` | ✓ |
| 5 | figmaMakePrompts | `z.array(z.string()).optional()` | ✓ |
| 6 | animationSpecs | `z.string().optional()` | ✓ |
| 7 | responsiveSpecs | `z.string().optional()` | ✓ |
| 8 | dataIntegration | `z.string().optional()` | ✓ |
| 9 | qaChecklist | `z.string().optional()` | ✓ |

### Prompt (buildSiteBrief9Prompt)
- System: "Populate ALL fields — scope, siteMap, userFlows, brandColors, designSystem (all 5 keys), clientInfo (all keys), componentLogic, figmaMakePrompts (5), animationSpecs, responsiveSpecs, dataIntegration, qaChecklist"
- User: "MANDATORY — Produce ALL 9 phases" with numbered checklist

### Proposal injection
- enrich-site-brief.ts L88-106: fetches `proposal: { summary, scopeOfWork }`
- L144-146: builds `proposalContent` from summary + scopeOfWork
- L162: passes `proposalContent` to SiteBriefContext

---

## 2. Client Engine → Builder (client.ts GenerateContentInput)

| Phase | clientInfo key | Type | ✓ |
|-------|----------------|------|---|
| 1 | siteMap | string | ✓ |
| 1 | userFlows | string | ✓ |
| 2 | designSystem | object (5 keys) | ✓ |
| 3 | heroHeadline, heroSubhead, ctaPrimary, features, testimonials, faq, footerTagline, tone | various | ✓ |
| 4 | componentLogic | string | ✓ |
| 5 | figmaMakeDesignIntent | string | ✓ |
| 6 | animationSpecs | string | ✓ |
| 7 | responsiveSpecs | string | ✓ |
| 8 | dataIntegration | string | ✓ |
| 9 | qaChecklist | string | ✓ |

---

## 3. Create Route (builder/create/route.ts)

| Phase | Passed as | Source | Line |
|-------|-----------|--------|------|
| 1 | siteMap | enrichment?.siteMap | 190 |
| 1 | userFlows | enrichment?.userFlows | 191 |
| 2 | designSystem | enrichment?.designSystem | 183 |
| 3 | heroHeadline, heroSubhead, ctaPrimary, features, testimonials, faq, footerTagline, tone | enrichment?.clientInfo | 176-182, 188 |
| 4 | componentLogic | enrichment?.componentLogic | 184 |
| 5 | figmaMakeDesignIntent | enrichment?.figmaMakePrompts?.[0] | 185 |
| 6 | animationSpecs | enrichment?.animationSpecs | 186 |
| 7 | responsiveSpecs | enrichment?.responsiveSpecs | 187 |
| 8 | dataIntegration | enrichment?.dataIntegration | 188 |
| 9 | qaChecklist | enrichment?.qaChecklist | 189 |

---

## 4. Regenerate Route (builder/regenerate/route.ts)

| Phase | Passed as | Source | Line |
|-------|-----------|--------|------|
| 1 | siteMap | enrichment?.siteMap | 126 |
| 1 | userFlows | enrichment?.userFlows | 127 |
| 2 | designSystem | enrichment?.designSystem | 120 |
| 3 | heroHeadline, heroSubhead, ctaPrimary, features, testimonials, faq, footerTagline, tone | enrichment?.clientInfo | 113-119, 125 |
| 4 | componentLogic | enrichment?.componentLogic | 121 |
| 5 | figmaMakeDesignIntent | enrichment?.figmaMakePrompts?.[0] | 122 |
| 6 | animationSpecs | enrichment?.animationSpecs | 123 |
| 7 | responsiveSpecs | enrichment?.responsiveSpecs | 124 |
| 8 | dataIntegration | enrichment?.dataIntegration | 125 |
| 9 | qaChecklist | enrichment?.qaChecklist | 126 |

---

## 5. Site-Builder Generate Route (site-builder/.../generate/route.ts)

| Phase | contextBlocks | Line |
|-------|---------------|------|
| 1 | `[Phase 1] Site map: ${clientInfo.siteMap}` | 103 |
| 1 | `[Phase 1] User flows: ${clientInfo.userFlows}` | 104 |
| 2 | `[Phase 2] Typography`, Spacing, Layout, Animation guidelines, WCAG | 98-102 |
| 4 | `[Phase 4] Component logic: ${clientInfo.componentLogic}` | 109 |
| 5 | `[Phase 5] Design intent: ${clientInfo.figmaMakeDesignIntent}` | 105 |
| 6 | `[Phase 6] Animation specs: ${clientInfo.animationSpecs}` | 106 |
| 7 | `[Phase 7] Responsive: ${clientInfo.responsiveSpecs}` | 107 |
| 8 | `[Phase 8] Data integration: ${clientInfo.dataIntegration}` | 108 |
| 9 | `[Phase 9] QA checklist: ${clientInfo.qaChecklist}` | 109 |

### Prompt
- L156: "9-PHASE SPEC — USE ALL: 1=Architecture 2=Design System 3=Content 4=Component Logic 5=Figma Make/Design Intent 6=Animation 7=Responsive 8=Data Integration 9=QA"
- L170: "Apply ALL 9-phase guidance: Phase 1... Phase 2... Phase 4... Phase 5... Phase 6... Phase 7... Phase 8... Phase 9..."

---

## 6. Test Route (internal/test/builder-gen-input/route.ts)

- Builds genInput with same logic as create route
- Returns `{ genInput, ninePhaseAudit: { present, missing, allPresent } }`
- NINE_PHASE_KEYS: siteMap, userFlows, designSystem, componentLogic, figmaMakeDesignIntent, animationSpecs, responsiveSpecs, dataIntegration, qaChecklist

---

## 7. Playwright Test (builder-9-phases.spec.ts)

1. Creates lead via POST /api/site/leads
2. Creates proposal via POST /api/proposals (pipelineLeadId, summary, scopeOfWork)
3. Creates delivery project via POST /api/delivery-projects (proposalId, pipelineLeadId)
4. Calls GET /api/internal/test/builder-gen-input?projectId=xxx
5. Asserts `key in ci` for all 9 phase keys
6. When ninePhaseAudit.allPresent: asserts present.length === 9, missing.length === 0

**Result:** ✓ 1 passed (38.6s)

---

## 8. Gaps / Edge Cases

| Item | Status |
|------|--------|
| brandColors | Passed to createSite (not generateContent) — used at site creation for themeColorsJson ✓ |
| contentHints | Packed into bio via packContentHintsForBuilder ✓ |
| Phase 3 (Content) in builder | hero/features/testimonials/faq/footer via MANDATORY blocks + contextBlocks ✓ |
| designSystem as object | Builder uses ds.typographyScale, ds.spacingSystem, ds.layoutPatterns, ds.animationGuidelines, ds.wcagNotes ✓ |
| **Flywheel** | **FIXED** — flywheel.trigger_builder previously passed richClientInfo without 9-phase fields. Now passes heroHeadline, heroSubhead, ctaPrimary, features, testimonials, faq, footerTagline, siteMap, userFlows, designSystem, componentLogic, figmaMakeDesignIntent, animationSpecs, responsiveSpecs, dataIntegration, qaChecklist. bio now uses contentHints (packed) as primary. |

---

## 9. Data Flow Summary

```
enrichSiteBrief(id)
  → LLM (site-brief-9) produces: scope, siteMap, userFlows, brandColors, designSystem,
    contentHints, clientInfo, componentLogic, figmaMakePrompts, animationSpecs,
    responsiveSpecs, dataIntegration, qaChecklist

create/regenerate
  → genInput = { sections, clientInfo: { ...all 9 phases... } }
  → generateContent(siteId, genInput)

generateContent (client.ts)
  → POST /api/sites/[id]/generate
  → body: { sections, clientInfo }

site-builder generate route
  → body.clientInfo
  → contextBlocks for each phase when present
  → basePrompt with 9-PHASE SPEC mandate
```

---

## 10. Verification Commands

```bash
# Run Playwright test
npx playwright test tests/e2e/builder-9-phases.spec.ts

# Type-check both repos
cd client-engine-1 && npx tsc --noEmit
cd site-builder && npx tsc --noEmit
```
