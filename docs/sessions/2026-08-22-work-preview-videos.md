# Session: Muted /work Remotion preview videos — 2026-08-22

## Goal
Show moving site renders on public `/work` cards and case pages instead of stills only, without live-demo buttons, Source/GitHub, or localhost leaks.

## Decisions Made
- Keep media in `Project.screenshots` (video first, still second for poster). No Prisma column or migration this week.
- `CardMedia` is a small client component: video when the path is `.webm`/`.mp4`/`.mov`, else existing `ScreenshotImg`. Missing webms fall back to the poster still.
- Remove the Live Demo button from `/work/[slug]`. Privacy gate (`public-demo-url`) stays on homepage, `/proof`, `/demos`.
- Do not invent large video binaries. Document the Forge drop path in `public/screenshots/README-previews.md`. Leave existing stills intact.
- Product slugs (autoflow, proof-qc-assist, clearfield, quickmarket) get an additive prepend script, not a wipe of `seed-projects.mjs`.

## What Was Built
- `src/lib/site/media-path.ts` — `isVideoPath`, poster resolution, `prependPreviewWebm`.
- `src/components/site/CardMedia.tsx` — muted loop `playsInline` autoplay, no controls, aria-label from alt.
- `/work` grid and `/work/[slug]` gallery use `CardMedia`.
- `portfolio-proofs.ts` screenshots: `[preview.webm, 1-hero.jpg]`.
- `scripts/seed-work-preview-videos.ts` + `npm run db:seed-work-preview-videos`.

## Key Insights
- Live catalog already stores paths under `/public`. A new column would force a migrate for no visitor-facing gain.
- Cards will look like today’s stills until Forge drops webms, because `onError` falls back to the poster.

## Trade-offs Accepted
- Homepage still shows “Live demo available” only when the allowlist passes. Case pages do not.
- Video files are expected on disk later; git stays still-only.

## Open Questions
- When Forge webms exist, decide whether to commit small files or serve them only from the VPS volume.

## Next Steps
- [ ] Operator runs `npm run db:seed-portfolio-proofs` and `npm run db:seed-work-preview-videos` on staging, then prod.
- [ ] Forge drops `preview.webm` per live slug.
- [ ] Hold Afterlight, Grove, Meridian, Energy Orb, Inner Green until craft time is done.
