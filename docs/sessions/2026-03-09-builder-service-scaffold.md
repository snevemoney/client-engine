# Session: Builder Service Scaffold — 2026-03-09

## Goal

Scaffold the builder service so it uses enrichment data (brandColors, designSystem, etc.) to produce non-green, non-generic frontends. The builder was referenced in docker-compose but the `builder/` directory did not exist.

## Decisions Made

- **Scaffold in-repo** — Create `builder/` as a sibling Next.js app in the same repo, matching docker-compose `context: ./builder`.
- **SQLite for builder** — Builder uses its own SQLite DB (file:./dev.db) to avoid coupling to main app's Postgres.
- **Theme from brandColors** — `getTheme(industry, brandColors)` maps 4 hex to primary, heroFrom, heroTo, accent. When brandColors empty, use industry-specific non-green fallbacks (teal, coral, indigo, amber).
- **Generate prompt** — Inject designSystem, animationSpecs, responsiveSpecs, etc. into LLM prompt with "9-PHASE DESIGN SPEC — APPLY ALL" and explicit "Do NOT use generic green" rule.

## What Was Built

- **builder/package.json** — Next.js 15, Prisma, Anthropic, Zod
- **builder/prisma/schema.prisma** — Site model (themeColorsJson, designSpecJson)
- **builder/src/lib/themes.ts** — getTheme(), industry fallbacks (no green)
- **builder/src/lib/db.ts** — Prisma client
- **builder/src/app/api/sites/route.ts** — POST create, stores brandColors as themeColorsJson
- **builder/src/app/api/sites/[id]/route.ts** — GET/PATCH site with sections
- **builder/src/app/api/sites/[id]/generate/route.ts** — POST generate with LLM, designSystem injection, brandColors storage
- **builder/src/app/api/sites/[id]/deploy/route.ts** — POST deploy (stub)
- **builder/src/app/api/sites/[id]/feedback/route.ts** — GET feedback (stub)
- **builder/src/app/preview/[id]/page.tsx** — Server-rendered preview using themeColorsJson
- **builder/Dockerfile** — Multi-stage build for standalone
- **builder/.env.example** — DATABASE_URL, ANTHROPIC_API_KEY, BUILDER_API_KEY
- **.env.example** — BUILDER_API_URL, BUILDER_API_KEY for main app

## Key Insights

- Client Engine sends full enrichment (brandColors, designSystem, etc.) to generate. The builder must store and apply it. Previously the builder didn't exist; now it does.
- Preview page reads themeColorsJson from DB and uses getTheme() so custom colors apply. No green default when brandColors provided.

## Trade-offs Accepted

- Builder is minimal (stub deploy/feedback). Full deploy (e.g. Vercel, Netlify) and AI feedback can be added later.
- SQLite for simplicity. Production may want Postgres.

## Next Steps

- [ ] Run `cd builder && npm install && npx prisma db push` to init
- [ ] Set BUILDER_API_URL=http://localhost:3001 and BUILDER_API_KEY=dev-key in main app .env
- [ ] Run builder: `cd builder && npm run dev`
- [ ] Create a delivery project with builder site and regenerate to verify non-green output
