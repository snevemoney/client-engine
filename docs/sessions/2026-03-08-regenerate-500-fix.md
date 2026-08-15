# Session: Regenerate 500 Fix — 2026-03-08

## Goal
Fix Regenerate returning 500 and ensure 9-phase enrichment flow is robust end-to-end.

## Root Cause
**Site-builder GET /api/sites/[id]** — `siteResponse()` called `JSON.parse(site.sectionsJson)` with no try/catch. Invalid or corrupted sectionsJson in the DB caused an unhandled throw → 500. Regenerate calls `getSiteWithSections` first, so it failed before reaching generate.

## What Was Done

### Site-Builder (root cause fix)
- **`src/app/api/sites/[id]/route.ts`** — siteResponse now wraps JSON.parse in try/catch; falls back to default hero section on parse error.

### Client Engine
- **`src/app/api/delivery-projects/[id]/builder/regenerate/route.ts`** — Wrapped getSiteWithSections and generateContent in try/catch. Builder failures now return 502 with the actual error message instead of 500. User sees the error in a toast.

### Site-Builder
- **`src/app/api/sites/[id]/generate/route.ts`** — Top-level try/catch in POST handler; unhandled errors return 500 with JSON body. Invalid sectionsJson returns 500 with clear message instead of crashing. Empty sections array falls back to minimal hero section.

## Decisions
- 502 for builder failures (not 500) — Distinguishes "builder service problem" from "internal server error".
- Site-builder returns 500 with JSON body on unhandled errors — Client Engine's builderFetch throws on !res.ok, so user gets the message via 502.

## Next Steps
- If Regenerate still fails: check site-builder terminal for the actual error (enrich-context fetch, runEnrichment, ANTHROPIC_API_KEY, etc.).
- Ensure ENRICH_CONTEXT_SECRET matches in both apps; APP_URL=http://localhost:3000 for local dev.
