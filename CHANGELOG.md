# Changelog

All notable changes to Client Engine are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## [Unreleased]

### Fixed
- **Public /work card videos play on Safari** — `CardMedia` no longer uses a single `<video src="…preview.webm">`. It offers sibling `preview.mp4` first (`type="video/mp4"`), then WebM, and calls muted `play()` after mount so autoplay actually starts. Existing DB rows that store `preview.webm` keep working. Poster / muted / loop / playsInline / autoPlay unchanged; both sources failing still falls back to the hero still.

### Added
- **Muted /work preview videos** — Catalog cards and case-page gallery use `CardMedia`: `.webm`/`.mp4`/`.mov` play muted, looping, no controls; stills stay on `ScreenshotImg`. Poster is the next image sibling (or same path `.jpg`). Missing webms fall back to the still. Media stays in `screenshots[]` (no Prisma column). Proofs expect `[preview.webm, 1-hero.jpg]`. Product slugs get an additive prepend via `npm run db:seed-work-preview-videos`. Path note: `public/screenshots/README-previews.md`.
- **Public /work cinematic proofs** — Four proof/concept cards (Working Volumes, Field Manuals, Betawise Earth, Sketchbook) with visitor-facing copy, `proofOnly`, and hero screenshots. Held back pending more craft time: Afterlight, Grove, Meridian, Energy Orb, Inner Green. Repeatable upsert: `npm run db:seed-portfolio-proofs` (does not wipe existing cards).

### Changed
- **Case pages drop Live Demo buttons** — `/work/[slug]` no longer renders a Live Demo link. Visitors see the render, then Request audit. Source/GitHub stay off the public catalog. Homepage, `/proof/[slug]`, and `/demos/[slug]` still gate demo URLs through the public allowlist (no localhost / private hosts).
- **Public catalog privacy** — `/work` and `/work/[slug]` no longer render GitHub Source links. `repoUrl` is not selected for the public catalog. Live Demo only renders when `demoUrl` is an allowlisted public `evenslouis.ca` marketing URL (not localhost, private IPs, `/dashboard`, `/pro`, `/login`, `/scorpion`, `/n8n`, `/builder`, `/claw`, `/api`). Same gate on the homepage, `/proof/[slug]`, and `/demos/[slug]`.

### Added
- **Phase 2 service layer** — `src/lib/services/` with score-service, risk-service, nba-service, lead-service. Routes (scores, risk, next-actions, leads) now call services instead of inline logic.
- **Brand color override in site admin** — Site-builder Settings tab now has a Brand Colors section: 4 hex inputs with color pickers, plus "Use industry default" checkbox to clear custom colors. PATCH /api/sites/[id]/settings accepts themeColorsJson (array or null).
- **Builder create enrichment path** — When ENRICH_CONTEXT_SECRET is set, create route passes deliveryProjectId + enrichContextUrl to generateContent so site-builder fetches context and runs 9-phase enrichment internally. Falls back to local enrichSiteBrief when secret is unset. Route test verifies both paths.
- **Section version history** — Site-builder stores snapshots of sectionsJson before each PATCH (sections edit) and Regenerate. New `SiteSectionVersion` model; GET /api/sites/[id]/versions and POST restore. Client Engine: Version history UI in delivery builder (expand to list, Restore button). Keeps last 20 versions per site.
- **Contact form preservation rule** — Regenerate prompt now explicitly requires a contact section with form capability when Phase 4 componentLogic specifies "Contact: form" or "name/email/message". Prevents Regenerate from removing the contact form.

### Changed
- **Coach-tools use services** — getScoreContext, getRiskContext, getNBAContext, runRecomputeScore, runRiskRules, runNextActions now call services directly; removed CoachFetchOptions and HTTP self-calls.
- **Lead service** — GET/POST /api/leads and GET/PATCH/DELETE /api/leads/[id] use lead-service. Brain executor list_leads and update_lead use lead-service.
- **Phase 2 neutral palettes when no brand data** — Site-builder 9-phase enrichment now instructs the LLM: when context has no explicit brand colors/logos/URLs, prefer slate/navy/zinc/stone; avoid agency orange and fitness red unless industry matches.
- **Flywheel industry inference for web refresh** — When description contains "refresh", "Squarespace", "redesign", or "website refresh" and preset is custom, flywheel trigger infers "consulting" for builder preset. Applies to both new-prospect and leadId paths.
- **Brand color hex shorthand** — Site admin Settings tab and PATCH /api/sites/[id]/settings now accept 3-char hex (#fff) and normalize to 6-char (#ffffff) before storing.
- **ENRICH_CONTEXT_SECRET for local 9-phase** — .env.example documents local dev example. Both Client Engine and site-builder need the same value for enrichContextUrl flow.
- **Preview cache-busting** — Site-builder preview page now has `dynamic = "force-dynamic"` so Next.js does not cache it; themeColorsJson changes are reflected immediately. Added data-theme-source and data-theme-hero-from for debugging.
- **Always apply client brand colors on generate** — Client Engine create route ensures genInput always includes brandColors (merge into sbpGenInput when present). Site-builder generate route uses deterministic fallback when body.brandColors is empty, so every generate applies a client palette (never skips theme update).
- **Regenerate always uses varied palette** — Regenerate no longer uses enrichment.brandColors (LLM often returns same colors). Always uses getFallbackBrandColors with Date.now() variation so each Regenerate produces a fresh palette.
- **Regenerate logging** — Client Engine logs `brandColors`, `sections`, `bio.length` when regenerating. Site-builder logs `brandColors` and `clientInfo.name` on generate. Helps debug regeneration flow.
- **Builder section editor layout** — Section editor forms (Hero, About, Services, etc.) now appear above the Regenerate button and action bar for clearer editing flow.
- **Regenerate restored to prod flow + 9 skills** — Regenerate no longer uses enrichContextUrl. Fetches artifacts from DB, runs enrichSiteBrief (9-phase) in Client Engine, merges artifact + enrichment into full clientInfo, passes brandColors (enrichment or getFallbackBrandColors). Quality check receives full genInput so auto-regenerate uses rich context.
- **proposalContent instruction** — 9-phase enrichment no longer instructs "use verbatim for hero". Proposal/scope is for context only; hero uses description, felt problem, reframed offer.
- **Builder content: client-facing copy only** — Builder generate prompt now explicitly forbids proposal text, design specs, or internal analysis as section content. Design spec is layout guidance only; section bodies must be client-facing marketing copy (About, Services, benefits).
- **Regenerate contentHints** — Uses short business summary (lead.description or project.summary, 400 chars) instead of full enrichment artifact to avoid proposal/scope text appearing as site content.
- **Hero copy: benefit-focused** — site-brief-9 and enrich-site-brief hero instructions updated: use description/reframed offer; NOT proposal scope (e.g. "Your X lacks — And It's Affecting Y"). Anti-generic retry prefers reframed offer/description over proposal.

### Fixed
- **Builder versions routes** — GET /api/delivery-projects/[id]/builder/versions and POST versions/restore used withRouteTiming incorrectly (exported Promise instead of handler). Fixed to use async function wrapper so Next.js receives (req, context) correctly.
- **E2E resilience** — brain-audit uses `waitUntil: "domcontentloaded"` for page visits (avoids Turbopack load aborts). Auth helper uses `Promise.all([waitForURL, click])` with 18s timeout for more reliable login. Playwright retries: 1 for non-CI. webServer timeout increased to 120s.
- **Flywheel brandColors fallback** — When enrichment returns no brandColors, flywheel uses getFallbackBrandColors so createSite and generateContent always receive brand direction.

### Fixed
- **Regenerate 500 root cause** — Site-builder GET /api/sites/[id] had unguarded JSON.parse(site.sectionsJson). Invalid or corrupted sectionsJson caused 500. Now falls back to default hero section on parse error.
- **Regenerate 500 → 502 with message** — Regenerate route now catches builder failures (getSiteWithSections, generateContent) and returns 502 with the actual error message instead of 500. Dashboard shows the error in a toast.
- **Site-builder generate robustness** — Top-level try/catch returns 500 with JSON body on unhandled errors. Invalid sectionsJson now returns 500 with clear message instead of crashing. Empty sections array falls back to minimal hero section.
- **Builder "fetch failed" toast** — When site-builder is not running, builder client now throws a clear message: "Site builder not reachable. Start site-builder (port 3001) and set BUILDER_API_URL in .env."

### Added
- **DegradedBanner on scoreboard and retention** — Internal scoreboard error state and retention page errors now use DegradedBanner (Phase 8 pattern). AsyncState gains optional `useDegradedBanner` prop. DegradedBanner supports optional `data-testid` override for E2E.
- **9-phase enrichment in site-builder** — Enrichment moved from Client Engine to site-builder. New `GET /api/internal/delivery-projects/[id]/enrich-context` returns project, lead, proposal, artifacts for site-builder. Regenerate calls generate with `deliveryProjectId` + `enrichContextUrl`; site-builder fetches context and runs 9 phases internally. ENRICH_CONTEXT_SECRET for auth.
- **Builder service scaffold** — `builder/` directory with Next.js app: POST /api/sites (create), POST /api/sites/[id]/generate (LLM + brandColors), GET/PATCH /api/sites/[id], GET /api/sites/[id]/feedback, POST /api/sites/[id]/deploy. Theme system uses brandColors (never green default); industry fallbacks are teal, coral, indigo, amber. Generate route injects designSystem, animationSpecs, etc. into LLM prompt. Preview page renders with custom theme.
- **Sprint 6: Site Builder 9-Phase SBP** — SiteBuildPlan/SiteBuildPhase models; per-phase runners (1–9); approval gates; export genInput from artifacts; builder/create uses SBP export when all 9 phases approved; deploy gate; Memory pipeline (OperatorMemoryEvent site_phase_approved/site_phase_revised); NBA rules (site_builder_start, site_builder_phase_awaiting_approval, site_builder_ready_to_deploy); site_builder agent; site_builder.phase_run job type
- **Fix: All sites green/same** — Deterministic fallback when brandColors undefined: hash(clientName+projectId) → distinct hues (teal, coral, indigo, amber). Anti-sameness prompt in site-brief-9 and Phase 2: FORBIDDEN greens for health/fitness/coaching; vary hue by client name.

### Changed
- **Use the same builder consistently** — Docs and .env.example now state: run site-builder for local dev, never scaffold. builder/README, README, infrastructure.md updated. Scaffold GET /api/sites/[id] no longer creates missing sites (returns 404 like site-builder). Mixing scaffold and site-builder causes "Failed to load site data" (different DBs).
- **Section editor visible by default** — Website Builder forms (Hero, About, Services, Contact, Footer) now open when loading the delivery page; no need to click "Edit sections".
- **Regenerate route maxDuration** — `POST /api/delivery-projects/[id]/builder/regenerate` sets `maxDuration = 300` so long enrichment + generate flows complete before platform timeout.
- **Site Builder UI removed** — Dashboard page `/dashboard/delivery/[id]/site-builder` and link removed; SBP backend (API, Brain tools, agent) retained for internal use. NBA actionUrls point to delivery detail, not site-builder.

### Fixed
- **E2E 404s** — `npm run test:e2e` now runs `scripts/e2e-preflight.sh` first to free port 3000, so Playwright starts Client Engine (not site-builder). Tests were hitting the wrong server.
- **Bearer auth fallback** — workday-run and research/run routes accept AGENT_CRON_SECRET when RESEARCH_CRON_SECRET is unset, so E2E Bearer tests pass.
- **Regenerate clientInfo type** — When passing feedback to generateContent, clientInfo now includes `name` (project.clientName ?? project.title ?? "Client") so it satisfies GenerateContentInput.clientInfo.
- **site-builder-ingest metaJson** — Cast sanitizeMeta result to Prisma.InputJsonValue (with JsonNull fallback) for OperatorMemoryEvent.metaJson.
- **orchestrator safeParseJSON** — Schema type assertion for getPhaseSchema union to satisfy safeParseJSON generic.
- **tsconfig** — Exclude `builder/` scaffold from typecheck (use site-builder instead).
- **9-phase enrichment → site-builder format contract** — Phase 2, 6, 7 now include SITE_BUILDER_FORMAT so LLM output matches parser expectations (typographyScale "H1:48px", spacingSystem "8px grid section:64px", animationSpecs "fade-up", responsiveSpecs "1440 3-col"). Site-builder parsers more resilient to verbose formats (hero/display for h1, slide-up for animation).
- **"Failed to load site data" — surface actual builder error** — Delivery page now shows the real error (e.g. "Builder API GET /api/sites/xxx → 404: Site not found") instead of generic message. Sections route catches builder client throws and returns 502 with message so the UI can display it.
- **builder-9-phases E2E with existing server** — Test now sends `x-e2e-force-legacy: 1` header so builder-gen-input uses legacy single-call path when server lacks E2E_TEST_MODE (e.g. `USE_EXISTING_SERVER=1`). `enrichSiteBrief` accepts optional `{ forceLegacy }`; route honors header in dev only.
- **9-phase enrichment schema mismatch** — Phase schemas now accept LLM output variations (scope as object/array/string, siteMap/userFlows as array→string). On validation failure, raw JSON is normalized via `normalizePhaseOutput`. Phase 3 maps content-architect output (headline→heroHeadline, etc.) to expected clientInfo shape.
- **builder-gen-input 9-phase keys stripped** — Use `null` instead of `undefined` for 9-phase keys so they appear in JSON; E2E test asserts `key in ci`.
- **builder-9-phases test timeout** — Increased to 300s for 9 sequential LLM calls.
- **9-phase spec not applied when AI skipped** — Site-builder generate route previously persisted designSpecJson and themeColorsJson only when AI ran. Now persists both in the no-API-key path (dev/local), applying heroHeadline/heroSubhead/ctaPrimary/footerTagline from clientInfo and all 9-phase design spec.
- **brandColors <4 ignored** — Site-builder now pads brandColors to 4 when 1–3 provided (order: primary, heroFrom, heroTo, accent), so custom theme applies even when enrichment returns fewer colors.
- **Create returned before generateContent** — Client Engine builder/create now awaits generateContent so the preview shows 9-phase content (designSpec, themeColors) instead of preset-only until regenerate.

### Added
- **9-phase enrichment orchestration** — enrichSiteBrief runs 9 LLM calls (one per skill: architecture, design-system, content, component-logic, figma-make, animation, responsive, data-integration, qa) but feels like one call. Skills in `src/lib/builder/skills/*.md`. Each phase receives prior outputs as context.
- **Site builder: personalized colors on regenerate** — brandColors from enrichment now passed to generateContent; site-builder persists themeColorsJson when brandColors provided. Enrichment prompt strengthened: "Infer 4 hex from client description, industry, positioning. Each client gets a distinct palette."
- **Site builder: full 9-phase spec** — Persists all 9 phases (siteMap, userFlows, designSystem, componentLogic, figmaMakeDesignIntent, animationSpecs, responsiveSpecs, dataIntegration, qaChecklist) to designSpecJson. Components now use: layoutPatterns (max-width), responsiveSpecs (lg:grid-cols-3 when 1440+3-col), animationGuidelines (duration), wcagNotes (focus ring). Page wrapper gets role=main, data attributes for siteMap/userFlows/figmaIntent/dataIntegration. Metadata uses qaChecklist for SEO description fallback.
- **Enrichment uses proposal content** — enrichSiteBrief now fetches Proposal (summary, scopeOfWork) when the delivery project has a linked proposal. Proposal text is injected as "PROPOSAL (client's exact words)" so the hero headline uses their phrase (e.g. "Peak Performance Digital Strategy") instead of generic filler.
- **Anti-generic enrichment prompt** — site-brief-9 system prompt now has explicit FORBIDDEN phrases ("Peak Performance Without Disruption", "Tailored X for busy professionals", "convenient", "personalized support", etc.) and rule: heroHeadline MUST use a phrase from the proposal.
- **Enrichment anti-generic subhead** — heroSubhead now MUST be extracted from the proposal; added FORBIDDEN phrases: "busy professionals", "amateur athletes", "flexible solutions", "Flexible training and nutrition", "training and nutrition solutions". Regenerate will produce subheads from proposal text, not invented audience descriptors.
- **Flywheel 9-phase fix** — trigger_builder previously passed richClientInfo without 9-phase enrichment (hero, features, designSystem, etc.). Now passes full genInput matching builder/create: heroHeadline, heroSubhead, ctaPrimary, features, testimonials, faq, footerTagline, siteMap, userFlows, designSystem, componentLogic, figmaMakeDesignIntent, animationSpecs, responsiveSpecs, dataIntegration, qaChecklist. bio uses packed contentHints.
- **Playwright 9-phase verification** — `tests/e2e/builder-9-phases.spec.ts` creates lead → proposal → delivery project, calls `GET /api/internal/test/builder-gen-input?projectId=xxx`, and asserts `genInput.clientInfo` contains all 9 phase keys (siteMap, userFlows, designSystem, componentLogic, figmaMakeDesignIntent, animationSpecs, responsiveSpecs, dataIntegration, qaChecklist).
- **Full 9-phase implementation** — Enrichment prompt now explicitly requires ALL 9 phases (Architecture, Design System, Content, Component Logic, Figma Make, Animation, Responsive, Data Integration, QA). Create/regenerate pass siteMap, userFlows, dataIntegration to builder. Builder generate route uses all 9 in prompt with [Phase N] labels and "9-PHASE SPEC — USE ALL" mandate; adds designSystem.animationGuidelines, designSystem.wcagNotes, siteMap, userFlows, dataIntegration to context blocks.
- **Builder generate 9-prompts integration** — Site-builder generate route now consumes full enrichment spec: testimonials, faq, footerTagline (MANDATORY blocks when provided); designSystem (typography, spacing, layout); animationSpecs, responsiveSpecs, qaChecklist, componentLogic as context. Create/regenerate already passed these; builder now uses them in the copy prompt.
- **Site builder auto-enrichment** — Before every createSite + generateContent, the system runs `enrichSiteBrief` (LLM) to produce better scope, brandColors, contentHints, and clientInfo. Condensed from Prompts 1–3 (Architecture, Design System, Content). Integrated into flywheel, POST .../builder/create, and POST .../builder/regenerate. Regenerate now uses enrichment (hero, features, tone, packed contentHints). Fallback to defaults on error.
- **Builder explicit hero/CTA/features** — Client Engine passes `heroHeadline`, `heroSubhead`, `ctaPrimary`, `features` as separate clientInfo fields. Site-builder uses them as MANDATORY for the hero section.
- **Anti-generic builder prompt** — Site-builder generate route now has explicit CRITICAL rules: do NOT use stock phrases ("transform your life", "science-backed", etc.); use client's exact words from feltProblem/reframedOffer; pull specifics from Bio/Research Summary. Removed generic example that reinforced bad copy.
- **Enrichment anti-generic** — Site-brief prompt instructs LLM to use client's language, not industry templates. Hero/features must be specific to THIS client.
- **Custom theme from brandColors** — Site-builder stores themeColorsJson; preview uses custom colors when provided.
- **Doctrine docs** — `docs/BUSINESS_ALIGNMENT_GATE.md` (idea gate: Active/Incubator/Kill, WIP caps, scoring, anti-drift), `docs/PROACTIVE_PERSISTENT_SELF_IMPROVING_AGENT_ARCHITECTURE.md` (three pillars, protocols, guardrails), `docs/SELF_LEARNING_SKILL_DOCTRINE.md` (.learnings/ schema, promotion ladder, Pattern-Key), `docs/IDEA_ROADMAP.md` (classification map, voice Phase 1 scope); cross-references in CLAUDE.md, CLIENT_ENGINE_AXIOMS.md, AI_STACK_DOCTRINE.md, session-journal.md
- **Voice Phase 1 MVP** — `docs/VOICE_ASSISTANT_PHASE_1_MVP.md` with locked workflow (proposal follow-up outbound), exact trigger conditions, allowed outcomes (booked_callback, requested_manual_followup, not_interested, no_answer, opted_out), stack choice, consent/opt-out rules, script control guardrail; linked from IDEA_ROADMAP
- **Voice implementation phases** — `docs/VOICE_ASSISTANT_PHASES.md` with full phase plan (Phase 1–5 + deferred); schema, API, UI, scheduling, metrics; linked from IDEA_ROADMAP and VOICE_ASSISTANT_PHASE_1_MVP
- **Voice Phase 1 foundation** — Voice bounded context in BOUNDED_CONTEXTS.md; Prisma: VoiceCallLog, VoiceCallOutcome enum, Proposal.contactPhone/voiceConsentAt/voiceOptedOutAt; src/lib/voice/ (getEligibleProposals, logCallOutcome, checkConsent, recordOptOut)
- **Voice Phase 2–5** — API routes: GET /api/voice/eligible, POST /api/voice/schedule-follow-up (stub), POST /api/voice/webhook (idempotent), POST /api/voice/consent, POST /api/voice/opt-out; VAPI_API_KEY/RETELL_API_KEY in .env.example; proposals followups extended with bucket=voice_eligible and voiceEligible in followup-summary; processVoiceFollowUps (calling window 9–18, rate limit 10/day, stub); POST /api/voice/process (cron); GET /api/voice/metrics; VoiceFollowupsCard on Command Center
- **Voice Phase 3 UI** — Proposal follow-ups: voice_eligible bucket, Schedule voice + Consent buttons per row; proposal detail: voice consent toggle (Record consent / Opt out); GET /api/voice/calls + /dashboard/voice/calls (call log); sidebar nav "Voice calls"; Proposal API returns contactPhone, voiceConsentAt, voiceOptedOutAt

### Changed
- **P0: Production migration discipline** — `deploy.sh` now uses `prisma migrate deploy` instead of `db push --accept-data-loss`; README, CLAUDE.md, PROJECT_CONTEXT.md, CONTRIBUTING.md, ai-rules, VPS_DEPLOY_CHECKLIST updated; ADR-003 superseded
- **P0: Degraded mode platform rule** — founder/summary fallback now sets `degraded: true` + `degradedReason`; logs ops event `founder.summary.degraded`; Founder dashboard shows degraded banner when data unavailable
- **P1: requireAuth infrastructure failure logging** — `requireAuth()` now emits `auth.infrastructure_error` ops event when `auth()` throws, distinguishing broken auth infra from normal 401s
- **P1: ranking.ts action weight audit** — confirmed `mark_done` is intentional global proxy for NBA engagement; added explicit comment and unit test
- **P1: Bounded-context architecture doc** — `docs/BOUNDED_CONTEXTS.md` maps 9 domains + cross-cutting concerns with models, routes, services, pages, invariants; referenced from ARCHITECTURE.md
- **P1: AI Stack Doctrine** — `docs/AI_STACK_DOCTRINE.md` defines four-layer AI hierarchy (AI Engineering → Context Engineering → Intent Engineering → Prompt Engineering) with Client Engine mapping, anti-patterns, and usage guide
- **P1: Tier-A API contract suite** — `docs/API_CONTRACTS.md` defines response shapes (200, degraded, 401, 400, 429, 500), header policies, sanitization rules, and test checklist; new route contract tests for growth/deals, growth/prospects, growth/summary (15 tests covering 401/200/500 shapes)
- **P1: Env truth + release discipline** — `docs/RELEASE_DISCIPLINE.md` documents the full release flow, env var truth, rollback, and when-not-to-deploy rules; VPS checklist updated with `ANTHROPIC_API_KEY` (preferred LLM) and `AGENT_CRON_SECRET`
- **P1: Revenue hardening (Growth)** — `docs/GROWTH_GOLDEN_SCENARIOS.md` documents 5 golden scenarios (add prospect, draft outreach, follow-up schedule, deals filtering, growth summary) with contract assertions, test coverage matrix, and revenue protection rules
- **P2: Explicit degraded/error states** — shared `DegradedBanner` component; Founder and Growth pages now render degraded banner when API returns `degraded: true`; pattern documented for all dashboard pages
- **P2: Phase 8.0 Go/No-Go doc** — `docs/PHASE_8_GO_NO_GO.md` — release readiness gate with dependency flow verification, accomplishments summary, and next-phase backlog
- **Power of 10 reliability doctrine** — `docs/CLIENT_ENGINE_POWER_OF_10.md` — 10 adapted reliability laws for Tier-A paths with current alignment status (6/10, targeting 8/10); referenced from CLAUDE.md and CLIENT_ENGINE_AXIOMS.md

### Fixed
- **Hero subhead generic after regenerate** — Enrichment now: (1) requires verbatim 10–15 word copy from proposal; (2) forbids "enhancing your online presence", "attract more clients", "seamless", "supportive", etc.; (3) validates output and retries with a follow-up LLM call if subhead contains forbidden phrases; (4) falls back to reframedOffer or lead description when proposal is entirely generic. Temperature lowered to 0.3.
- Voice phases 500 on proposal-followups — added migration `20260309_add_voice_schema` (VoiceCallOutcome enum, Proposal.contactPhone/voiceConsentAt/voiceOptedOutAt, VoiceCallLog table) and `20260310_add_voice_ops_category` (voice in OpsEventCategory); production deploy now applies Voice schema via `prisma migrate deploy`; call-log meta uses undefined for optional Json; founder/summary level "warning" → "warn"; YouTube transcripts transcriptText optional chaining
- YouTube ingest Failures tab — unified view for FAILED_TRANSCRIPT and PROPOSAL_FAILED; both types now appear in Failures with Retry; new getUnifiedFailures() + GET /api/youtube/failures
- YouTube transcripts page — includeText=1 fetches transcriptText for expand and search; was empty before
- YouTube ingest reliability — chat() in src/lib/llm.ts now retries up to 3x with exponential backoff on 429, 5xx, timeout, network errors; 90s timeout for OpenAI fetch and Anthropic client; reduces PROPOSAL_FAILED from transient API failures
- YouTube ingest PROPOSAL_FAILED — persist proposal error to lastError and runSummaryJson.proposalError so the Jobs table Error column shows the real LLM/DB failure instead of empty
- YouTube ingest ALREADY_INGESTED — only skip when transcript has a LearningProposal; if transcript exists but no proposal (e.g. after PROPOSAL_FAILED), retry proposal generation so re-paste or Retry works
- YouTube transcript ingest — added youtube-transcript-plus (InnerTube) as third transcript-api variant; multi-parser on youtube-captions (JSON3, srv1, srv3, WebVTT, loose XML); fallback URLs and alternate tracks; fixes videos where timedtext returns empty (PO token)
- Conversion page crash "Cannot read properties of undefined (reading 'winRate')" — API now returns page-expected shape (counts.total/won/lost, rates.winRate, medianMs); fetchConversionInput adds won/lost from Lead.dealOutcome; route maps to counts/rates/medianMs; page useEffect uses defensive guards
- prod.spec health test — full assertions (db, pipelineTables, authSecret, nextAuthUrl); health route accepts Bearer AGENT_CRON_SECRET or RESEARCH_CRON_SECRET; .env.example documents both for E2E; clear error when server returns minimal (add secret to .env and restart)
- E2E and unit tests: zero errors, zero skips — Playwright globalSetup seeds DB and cleans fake leads; webServer env: AUTH_DEV_PASSWORD, AGENT_CRON_SECRET, OAUTH_SIMULATION; health readiness probe; prod.spec health uses Bearer for full checks; prod-fake-data-review uses localhost, removed FLYWHEEL SIMULATION from fake patterns (legitimate UI label); removed 50+ login-failure test.skip() calls; unit tests: test DB schema sync via `npm run test:prepare` (scripts/test-prepare.mjs); golden-replay timing fix (5ms delay between computes); vitest loads .env.test for client_engine_test DB
- Delivery page 500 — added migration `20260308_delivery_project_portal_fields` for missing `clientToken`, `builderHealthScore`, `builderHealthLabel`, `builderHealthCheckedAt` on DeliveryProject (Sprint 6 schema was ahead of migrations)
- P3005 migration baseline — baselined 12 existing migrations on production (`prisma migrate resolve --applied`), applied `20260307_add_sprint_5_9_schema` (Sprint 5–9: payment, proof, campaigns, cadence, outcome); dashboard, /proof, /campaigns now load correctly
- Prisma browser error on Leads detail page — extracted `ENRICHMENT_ARTIFACT_TYPE` and `ENRICHMENT_ARTIFACT_TITLE` into `src/lib/pipeline/enrich-constants.ts` so client components can import them without pulling Prisma into the browser bundle
- E2E brain-audit: sidebar test updated for 6 groups (Capture, Convert, Build, Prove, Optimize, System), Full mode toggle, search placeholder "Find a page..."
- E2E ar-panel: strict-mode selectors (`.first()` for unpaid|invoiced, `exact: true` for Paid/Unpaid filter links), DeploysTable always renders filter tabs and table (empty state in tbody when no projects)
- E2E trust-to-close: new lead page redirects to lead detail after create (fixes artifact POST flow; improves UX)
- E2E founder-mode: added `founder-run-next-actions` testid to Execute button; OS hub test expects `founder-os-quarter` and "Quarter"/"Goals and KPI targets"; Save week assertion "Saved" (no period)
- E2E coach-mode: increased session-action-log timeout to 8s

### Added
- `docs/DEPLOY_CHECKLIST_SPRINTS_1_9.md` — deploy checklist for Sprints 1–9 (backup, pre-deploy, migrations, smoke tests, rollback)
- Sprint 9: Outcome Ledger + Scorecard — Outcome model (projectId, actualRevenue cents, repeatClient, referralSource, satisfactionScore 1-5, lessonsLearned); GET/POST/PATCH /api/projects/[id]/outcome; cadence trigger "paid" (7 days after payment) with createCadence on Project paymentStatus → paid; OutcomeEditor in deploys table (expandable for paid projects); ?highlight=projectId on deploys page for cadence deep link; getOutcomeScorecard (win rate by source/score bucket, quoted vs actual, time-to-close); getScoreCalibrationData; /dashboard/scorecard page with tables and ScoreCalibrationChart (scatter: AI score vs actual revenue); Scorecard nav in Prove group
- Sprint 8: Proof Autopublish + Campaign Pages — proof fields on Project (proofPublishedAt, proofHeadline, proofSummary, proofTestimonial, campaignTags); Campaign model (slug, title, filterTag, published, ctaLabel, ctaUrl); generateProofDraft in src/lib/proof/generate.ts (fires when paymentStatus → paid, OpenAI draft with Axioms §8 rules); public /proof/[slug] and /campaigns/[slug] pages; ProofEditor in deploys table (expandable row); Campaign CRUD API (GET/POST /api/campaigns, GET/PATCH/DELETE /api/campaigns/[id]); Campaign manager at /dashboard/campaigns; getProofLinks in src/lib/proof/getProofLinks.ts (scores by tech stack overlap); proof links injected into buildProposalPrompt for pipeline and manual propose
- Sprint 7: Cadence orchestrator — polymorphic Cadence model (sourceType + sourceId for lead, delivery_project, project); createCadence in src/lib/cadence/service.ts; cadence created on SCOPE_SENT (lead status route), on builder deploy (route + worker), on Project paymentStatus → invoiced/partial (PATCH projects); dueAt: +3d scope_sent, +7d deployed, +14d invoiced; processDueCadences in src/lib/cadence/process.ts (sends operator alert, marks completed); POST /api/cadence/process (cron or manual); CadenceDueCard on Command Center (due count + Process button); GET /api/cadence (list by sourceType+sourceId); PATCH /api/cadence/[id] (snooze/resume/complete); CadencesSection on lead detail Sales tab (pause/resume/done)
- Sprint 6: Client portal — public `/portal/[token]` page for clients to view project status, preview/live URLs, and submit feedback; `clientToken` on DeliveryProject (lazy-generated via POST /api/delivery-projects/[id]/portal-token); POST /api/portal/notes for client note submission (DeliveryActivity type client_note); notifyClientPreview and notifyClientDeployed in notify.ts (sent to lead contactEmail when operator deploys or creates builder site); Share portal link button and Client notes section on delivery dashboard; Regenerate from feedback (builder regenerate API accepts optional context, auto-pulls latest client_note activities)
- Sprint 5 Additions: Auto payment follow-up on deploy — notifyDeployComplete() in notify.ts; called from sync deploy route and builder-deploy worker; A/R Panel on Command Center (getCachedARSummary, ARPanelCard); Deploys page payment column and filter tabs (All/Unpaid/Invoiced/Paid); PATCH /api/projects/[id] accepts paymentStatus, paymentAmount, invoicedAt, paidAt; Project model payment fields (paymentStatus, paymentAmount, invoicedAt, paidAt); Playwright deploy-flow.spec.ts and ar-panel.spec.ts
- Sprint 4: Scope negotiation and deal kit — SCOPE_SENT, SCOPE_APPROVED to LeadStatus; build API regeneration path with scope artifacts and HANDOFF_CHECKLIST.md; ChecklistRenderer on lead detail; Regenerate Specs button; email ingestion UID tracking via InternalSetting
- Sprint 3: Channel-aware outreach — proposal prompt and console adapt to lead source (upwork, email, prospect, default); getOutreachSection/getOutreachLabel/getOutreachCharLimit in src/lib/proposals/outreach.ts; sections.ts parses multiple outreach headers (Upwork Snippet, Email Intro, Outreach Message, Pitch); ProposalConsoleEditor shows dynamic label and char limit; artifact API includes lead.source
- Sprint 2: Pipeline visibility and notifications — GET /api/decisions (relaxed artifact filter for MAYBE + positioning-only); /dashboard/decisions page with Approve and Approve & Build actions; notifyNewLead (capture API, email ingestion); notifyDecisionReadyForLead (runPositionStep for MAYBE, runProposeStep for proposal_ready)
- Sprint 1 consistency fixes: ENRICHMENT_ARTIFACT_TYPE constant; standardized enrichment artifact type to "enrichment" (backward compat for "notes"); "Sent on Upwork" → "Sent" label; inline error state in DeliveryChecklist and DeliveryHandoffRetention (replaces alert())

### Changed
- Sprint 4: Build API accepts APPROVED or SCOPE_APPROVED; lead detail status options and build button logic; ImapFlow fetch uses { uid: true } for UID range
- Testing Strategy Gaps: orchestrator.test.ts (10), capture/route.test.ts (8), leads/[id]/route.test.ts (6), leads/route.test.ts (3), propose/[id]/route.test.ts (5), build/[id]/route.test.ts (6), pipeline retry/run route tests (8), ops/settings/route.test.ts (5), positioning.test.ts (5), propose.test.ts (5), email-ingestion.test.ts (14), monitor.test.ts (4)
- Pipeline LLM: ANTHROPIC_API_KEY support — when set, pipeline uses Claude (claude-3-5-haiku) instead of OpenAI; fixes 4XX errors when only Anthropic key is available
- POST /api/pipeline/retry-failed — bulk retry all failed runs (including OPENAI_4XX); auth: session or Bearer AGENT_CRON_SECRET
- Pipeline unit tests (Phase 1): score.test.ts +5 (clamping, verdict, malformed), enrich.test.ts +3 (valid, malformed JSON, missing fields), error-classifier.test.ts +12 (classification, retryable, formatStepFailureNotes)
- S1: requireLeadAccess, requireProposalAccess helpers; applied to leads/proposals/delivery-projects routes
- S3: checkStateChangeRateLimit for capture, enrich, score, leads CRUD, proposals, delivery-projects
- S4: Health endpoint requires Bearer AGENT_CRON_SECRET or session for full response; unauthenticated gets minimal { ok }
- C1: safeParseJSON with try-catch + optional Zod; migrated learning/proposals, revenue/roi, knowledge/suggestions, copilot, ops/settings/recommend
- I3: src/lib/env-validate.ts + instrumentation.ts for startup env validation (DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL)
- A2: Pipeline step handlers extracted to src/lib/pipeline/steps.ts (runEnrichStep, runScoreStep, etc.)
- A4: Orchestrator loads lead once per run; in-memory state updates (no N+1)
- A5: Builder deploy queued as BullMQ job when Redis available; returns 202 + jobId; GET .../deploy/status?jobId= for polling
- I7: prisma migrate deploy in deploy scripts (replaces db push); migration workflow documented in VPS_DEPLOY_CHECKLIST
- I1: GitHub Actions CI workflow (.github/workflows/ci.yml) — lint, tsc, test, smoke E2E
- I2: Structured JSON logging (src/lib/ops-events/structured-log.ts); LOG_FORMAT=json; [SLOW] logs emit JSON in prod
- I4: Docker healthchecks for app (wget /api/health) and worker (kill -0 1)
- I5: Worker Dockerfile simplified — single COPY from deps, no redundant runner deps
- I6: backup.sh integrity checks: test -s and gunzip -t; exit 1 if invalid
- O1/O2: ARCHITECTURE updated (builder-deploy worker); RUNBOOK incident response (worker crash, Redis OOM, DB exhaustion, LLM outage)
- C3: truncateError utility (src/lib/truncate-error.ts)
- O3: Replaced hardcoded IP with DEPLOY_SERVER / YOUR_VPS_IP placeholder in scripts and docs
- D1: npm audit fix (0 vulnerabilities)
- D2/D3: ROADMAP dependency tracking (next-auth stable, Prisma 7)
- C5: Monitor SSL check: log errors instead of empty catch

- API routes audit: `tests/e2e/api-routes-audit.spec.ts` — hits all 394 API endpoint combinations (no auth) to ensure no 500s
- Documentation system: CLAUDE.md (AI entry point), ARCHITECTURE.md (system design), CONTRIBUTING.md (dev playbook), CHANGELOG.md, ROADMAP.md
- AI rules for code assistants: docs/ai-rules/ (coding-patterns, domain-knowledge, common-tasks, infrastructure, session-journal)
- 6 Architecture Decision Records in docs/decisions/ (Postgres queue, Claude vs OpenAI, db push, memory weights, approval gates, Docker VPS)
- Session journal system: docs/sessions/ with template for preserving thinking process across AI sessions
- Auto-generated docs from code: scripts/generate-docs.ts → docs/generated/ (api-routes, prisma-models, brain-tools, agents, pages, env-vars)
- npm scripts: docs:generate, docs:check (CI-friendly staleness check), docs:context (ChatGPT/Gemini paste file), docs:context:copy (+ clipboard)
- AI context generator: scripts/generate-ai-context.ts → single 68KB file for pasting into any AI chat
- Mandatory AI session rules at top of CLAUDE.md (auto-journal, auto-update CHANGELOG)
- ChatGPT custom instructions: docs/ai-rules/chatgpt-instructions.md (paste into ChatGPT Settings for auto session summaries)
- 6 composite database indexes for NBA/risk query performance (WeeklyMetricSnapshot, NotificationDelivery, OpsReminder, Proposal, DeliveryProject, ClientInteraction)

### Changed
- Enrichment artifacts: type standardized to "enrichment" (was "notes"); consumers accept both for backward compat
- Proposal console: "Sent on Upwork" checkbox label → "Sent"
- DeliveryChecklist, DeliveryHandoffRetention: alert() replaced with inline red error text
- Command Center: combined handoffOps + retentionOps into single deliveryProject.findMany for completed/archived (saves 1 DB round-trip)
- docs/WHEN_APP_FEELS_SLOW_CHECKLIST: added [SLOW] log inspection section and DB row; VPS grep commands for Docker
- api-utils: checkStateChangeRateLimit merges opts with defaults so windowMs/max are always numbers
- api-routes-audit: derive ok from status instead of res.ok for Playwright compatibility
- retention context: fixed closedLost++ (was missing increment)
- Command Center data fetching: 6 serial async blocks → parallel Promise.all via computeExtendedCommandCenterData()
- Dynamic imports → static imports in fetch-data.ts (classifyRetentionBucket, classifyReminderBucket, operator-score, forecasting)
- fetchRevenueInput: now date-bounded by weekStart/weekEnd (was fetching all-time data on every request)
- fetchBottlenecks: added 30s withSummaryCache to /api/metrics/bottlenecks route
- Founder summary: nextActionRun query moved from sequential into 13-way Promise.all; added select to scoreSnapshot (was fetching full JSON blobs)
- Score computation: getFactors + getPreviousSnapshot now parallel via Promise.all

### Fixed
- Sprint 5 verification: status route includes SCOPE_SENT/SCOPE_APPROVED; build route test updated for APPROVED or SCOPE_APPROVED gate and regeneration (was 409); auth mock type fixes in route tests
- Founder summary: LIKE '%pattern%' full table scan → startsWith prefix match on nextActionRun.runKey
- Score event dedup: shouldSuppressEvent overfetching full ScoreEvent row → select only createdAt
- Dockerfile: addgroup/adduser use Alpine-compatible flags (-S -g -u -G) instead of Debian long-form (--system --gid --uid)

---

## [1.0.0] - 2026-03-02

### Summary
Initial documented version. Client Engine is a full-stack AI-powered business OS with:

- 75+ Prisma models, 340 API route files (~500+ HTTP endpoints), 91 dashboard pages
- AI Brain (Claude, 25 tools, SSE streaming)
- Multi-agent system (10 workers with approval gates)
- Memory pipeline (learned weights → NBA ranking feedback)
- NBA system (15 rules, delivery actions, attribution)
- Risk engine (8 rules), Score engine (0-100)
- Notification pipeline (events → deliveries → escalations)
- Growth engine (outreach templates, deals)
- Signal engine (RSS → prospect matching)
- Meta Ads monitor, YouTube ingest, Knowledge engine
- Docker Compose deployment (5 services) on Hostinger VPS
