# Session: iOS case-study duplicate stills — 2026-08-22

## Goal
Stop proof case pages (e.g. `/work/betawise-earth`) from showing a frozen Meridian-looking still twice on iPhone Safari, and put the VPS hotfix into git.

## Decisions Made
- Filter at render time with `galleryMediaItems()` instead of changing seed data. Proofs still store `[preview.webm, 1-hero.jpg]` so `CardMedia` can resolve a poster.
- Drop a still only when it is merely the poster for a listed video (no other independent stills). Product galleries that prepend `preview.webm` in front of several screenshots keep every still.
- Pass the full `project.screenshots` list as `siblings` so poster resolution still works after the grid is filtered.
- Rename the heading to "Preview" when the filtered list is video-only.
- Harden `CardMedia` play instead of treating every `<video onError>` as a missing file. iOS Safari often fires a transient error while the poster is showing.

## What Was Built
- Created `src/lib/site/gallery-media.ts` — `galleryMediaItems(screenshots)`.
- Created `src/lib/site/gallery-media.test.ts`.
- Modified `src/app/work/[slug]/page.tsx` — Screenshots grid uses the filtered list.
- Modified `src/components/site/CardMedia.tsx` — MP4 then WebM sources, forced muted/playsInline, play retries, strict `NETWORK_NO_SOURCE` fallback.
- Updated `src/components/site/CardMedia.test.tsx`.

## Key Insights
- Mapping every `screenshots[]` path through `CardMedia` doubles the same visual: looping video (stuck on poster on iOS) plus the hero still.
- `onError` on `<video>` is not a reliable "file missing" signal on iOS.

## Trade-offs Accepted
- Seed rows stay `[preview.webm, 1-hero.jpg]`. The duplicate is a presentation concern, not a data wipe.
- Cache-bust `?v=4` on video sources only.

## Open Questions
- None for this fix. Live VPS hotfix should be replaced by this PR when deployed.

## Next Steps
- [ ] Review and merge the PR (do not merge from this session).
- [ ] Deploy later so the git fix replaces the VPS hotfix.
