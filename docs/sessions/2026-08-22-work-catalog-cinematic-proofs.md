# Session: Public /work cinematic proofs + catalog privacy — 2026-08-22

## Goal
Add this morning’s cinematic/demo site builds to the public `/work` catalog as proof/concept cards, and harden public catalog pages so visitors never see source repos, private demos, or internal product.

## Decisions Made
- Ship four new proofs only: working-volumes, field-manuals, betawise-earth, sketchbook.
- Hold Afterlight, Grove, Meridian, Energy Orb, and Inner Green out of CASE_COPY, seed upsert, and `public/screenshots` — more craft time. Do not delete their source elsewhere.
- Existing cards (autoflow, clearfield, proof-qc-assist, quickmarket) stay untouched.
- Public cards use the same `status: "live"` as autoflow/clearfield (`prisma/seed-projects.mjs`).
- `repoUrl` / `repoPath` / `demoUrl` stay null on new rows. Public UI never renders Source/GitHub. Demo links pass an allowlist (`evenslouis.ca` HTTPS, blocked internal paths).
- Repeatable upsert script only; do not wipe existing projects. Operator runs seed against staging/prod — this session does not deploy.

## What Was Built
- `src/lib/site/public-demo-url.ts` — allowlist gate for public demo URLs.
- `src/lib/site/portfolio-proofs.ts` — four-proof catalog data (null repo/demo, live status, hero paths).
- CASE_COPY entries with `proofOnly: true` and visitor-facing craft language.
- Public pages: `/work/[slug]` Source block removed; homepage, `/proof/[slug]`, `/demos/[slug]` gated.
- `scripts/seed-portfolio-proofs.ts` + `npm run db:seed-portfolio-proofs`.
- Hero JPGs at `public/screenshots/<slug>/1-hero.jpg` for the four shipped slugs.

## Key Insights
- Live catalog status is `live`, not `published`. Draft would still show (`status not archived`) but would not match existing cards.
- `/proof` must not be treated as the blocked `/pro` prefix.
- Cloud VM did not receive original attachment binaries on disk; heroes were reconstructed from the attached screenshots. Operator can replace the JPGs with the exact local captures if they differ.

## Trade-offs Accepted
- Held unfinished cinematic cards rather than shipping them.
- Demo allowlist is conservative (only evenslouis.ca). Existing GitHub `repoUrl` values remain in the DB but are no longer selected or rendered on public catalog pages.

## Open Questions
- When held-back proofs are ready, add CASE_COPY + seed rows + screenshots in a follow-up PR.

## Next Steps
- [ ] Operator runs `npm run db:seed-portfolio-proofs` against staging, then prod, after merge. Later rows include `preview.webm` first (see 2026-08-22-work-preview-videos).
- [ ] Replace reconstructed heroes with exact local screenshots if needed.
- [ ] Add Afterlight, Grove, Meridian, Energy Orb, and Inner Green when craft time is done.
