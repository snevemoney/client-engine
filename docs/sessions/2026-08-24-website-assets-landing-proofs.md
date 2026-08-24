# Session: Website-assets landing proofs on /work — 2026-08-24

## Goal
Add eight proof-only `/work` cards for the operator’s website-assets landing verticals (same base, different vertical + colour/bg). Public cards must stay proof-only: no Source, no GitHub, no localhost, no live demo links.

## Decisions Made
- Append the eight slugs to `PORTFOLIO_PROOF_SLUGS` rather than creating a second seed list. `db:seed-portfolio-proofs` already upserts `allPortfolioProofRows()`, so one catalog is enough.
- Leave `HELD_BACK_PORTFOLIO_PROOFS` untouched (Afterlight, Grove, Meridian, Energy Orb, Inner Green).
- `demoUrl` / `repoUrl` / `repoPath` stay null via the existing `portfolioProofRow()` seed pattern.
- Tech stack is `HTML` / `CSS` / `JS` — these are static landing emits, not Three.js cinematic proofs.
- Do not commit hero/preview binaries. Forge docker-cps `1-hero.jpg` + `preview.webm`/`preview.mp4` after merge.
- Copy matches cinematic proofs: `proofOnly: true`, “Proof / concept — … No app, no repo, no product.”

## What Was Built
- `src/lib/site/case-copy.ts` — CASE_COPY for the eight landing slugs.
- `src/lib/site/portfolio-proofs.ts` — slugs, names, HTML/CSS/JS stacks.
- Tests updated so the catalog contract includes the eight landings.
- Seed log line no longer says “four new proof cards”.
- CHANGELOG, ROADMAP, preview README, session journal.

## Key Insights
- Public catalog privacy is already enforced: seed writes null URLs; `/work` does not render Source; demo links are allowlisted. New rows inherit that if they stay on `portfolioProofRow()`.
- Screenshot dirs are not required in the PR. Paths are `/screenshots/{slug}/preview.webm` then `/screenshots/{slug}/1-hero.jpg`. Missing webms fall back to the still.

## Trade-offs Accepted
- Cards will look empty until Forge drops media. Prefer that over committing large binaries.
- Did not add localhost demo URLs even for operator reference.

## Open Questions
- None for catalog data. Media drop is operator/Forge after merge.

## Next Steps
- [ ] Operator runs `npm run db:seed-portfolio-proofs` against staging, then prod, after merge.
- [ ] Forge drops `public/screenshots/{slug}/1-hero.jpg` and `preview.webm`/`preview.mp4` for the eight landing slugs.
