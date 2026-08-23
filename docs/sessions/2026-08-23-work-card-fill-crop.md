# Session: /work fill video crop on iOS — 2026-08-23

## Goal
Fix `/work` fill cards cropping away Betawise's spinning globe (`object-top`) and reading as a frozen starfield/chrome still on iPhone.

## Decisions Made
- Fill videos use `object-center` instead of `object-top` so the globe stays in the 160px card frame.
- Do not set `poster` when `fill` is true. iOS often leaves the poster up; without it the video frame is what shows.
- Keep the iOS-aware playback path already proven on the sibling case-study branch: MP4 then WebM, muted / `playsInline` / `webkit-playsinline`, forced `play()`, IntersectionObserver at 25% visible.
- Cache-bust sources at `?v=6` so phones pick up the new files/behavior.
- Non-fill case-page videos still get a poster (gallery is not a tight crop).

## What Was Built
- Modified `src/components/site/CardMedia.tsx` — fill crop + no fill poster + MP4-first sources + play retry.
- Modified `src/components/site/CardMedia.test.tsx` — fill asserts `object-center` and no poster; sources use `?v=6`.

## Key Insights
- `object-top` on a short card crops the middle of a 16:9 Remotion render. Betawise's globe sits mid-frame.
- iOS Safari treating `poster` as the visible layer is why fill cards looked frozen even when the video was playing underneath.

## Trade-offs Accepted
- Fill cards have no poster fallback while buffering. A brief empty frame is better than a frozen still that never yields.
- Main did not yet have the MP4-first / IntersectionObserver path; this PR brings it in rather than leaving fill cards on a single `.webm` `src`.

## Open Questions
- Whether later iOS case-study still-duplication work (sibling branch) should land after this.

## Next Steps
- [ ] Review and merge; do not deploy from this session.
- [ ] Confirm Betawise / Sketchbook fill cards on an iPhone after deploy.
