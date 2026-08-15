# Session: Next Steps Implementation — 2026-03-10

## Goal
Implement the four follow-up items from the previous session:
1. Confirm version history (Regenerate → Version history → Restore)
2. Restore contact form (add prompt rule so Regenerate preserves it)
3. ENRICH_CONTEXT_SECRET in both apps for local 9-phase enrichment
4. Production indexes on VPS

## Decisions Made
- **Contact form** — Add prompt rule in site-builder generate route rather than manual section edit. Rule: "CONTACT SECTION: MUST include a contact section... Preserve form capability when Phase 4 specifies Contact: form."
- **ENRICH_CONTEXT_SECRET** — Add to both .env files; document in .env.example with local dev example. Site-builder already had it; Client Engine .env was updated.
- **Production indexes** — Deploy runs `prisma migrate deploy`; user must run `./scripts/deploy-remote.sh` (or SSH + deploy) on VPS. Deploy failed in-session due to SSH key (git pull).
- **Version history** — Implementation complete; manual verification recommended (Regenerate → Version history → Restore).

## What Was Built

### Site-builder
- **`src/app/api/sites/[id]/generate/route.ts`** — Added STRUCTURAL rule: "CONTACT SECTION: MUST include a contact section (type 'contact') with title, body, and email. Preserve form capability — when [Phase 4] componentLogic specifies 'Contact: form' or 'name/email/message', the contact section must remain so clients can receive form submissions. Do not remove or replace it with links-only."

### Client Engine
- **`.env.example`** — Documented ENRICH_CONTEXT_SECRET with local dev example. Added to .env (local-9-phase-enrich-secret).
- **CHANGELOG.md** — Contact form preservation rule, ENRICH_CONTEXT_SECRET docs.

### Site-builder .env
- ENRICH_CONTEXT_SECRET was already set.

## Key Insights
- Regenerate runs enrichSiteBrief in Client Engine and passes full clientInfo; it does not use enrichContextUrl. ENRICH_CONTEXT_SECRET is for the optional path where site-builder fetches context and runs 9 phases internally.
- Contact form visibility: ContactSection uses `getComponentLogicHints(spec?.componentLogic).contactForm ?? true` — default is form. When componentLogic says "Contact: form" or "name/email/message", form shows. The prompt rule ensures the AI doesn't remove the contact section or replace it with links-only.

## Next Steps (User Actions)
- [ ] **Version history** — Regenerate or edit a section, open "Version history", confirm versions appear and Restore works.
- [ ] **Contact form** — If Sarah Mitchell's site still lacks the form, either: (a) Restore from a version that had it, or (b) Edit sections and add a Contact section with form.
- [ ] **Production indexes** — Run `./scripts/deploy-remote.sh` (or SSH to VPS and run deploy) to apply `prisma migrate deploy`. Requires SSH key for git pull.
