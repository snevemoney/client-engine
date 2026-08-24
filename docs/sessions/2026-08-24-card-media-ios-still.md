# Session: CardMedia iOS still underlay — 2026-08-24

## Goal
Stop `/work/[slug]` Screenshots from painting a black rectangle on iOS Safari when the gallery item is a non-fill video.

## Decisions Made
- Decision 1: Always stack a still under the video. Non-fill wraps in a relative container; the still sizes the box; the video is `absolute inset-0 z-[1] opacity-100` on top. Never return video-only.
- Decision 2: Keep fill stacking: still `z-0` + video `z-[1] opacity-100`. No HTML `poster` (Safari sticks on that frame).
- Decision 3: Cache-bust preview MP4/WebM and video-underlay stills at `?v=17` so iOS drops dirty cached heroes. Leave an existing `v=` query alone.
- Decision 4: Do not add or tighten `galleryMediaItems`. A single video gallery item still shows its still underlay via `CardMedia`.
- Decision 5: MP4-first then WebM `<source>` tags, in-view `play()`, and `NETWORK_NO_SOURCE`-only fallback — same Safari constraints as the fill-card work.

## What Was Built
- Modified `src/components/site/CardMedia.tsx` — non-fill still underlay; fill z-0/z-1 stack; no poster; `?v=17` underlay.
- Modified `src/lib/site/media-path.ts` — `PREVIEW_VIDEO_CACHE_BUST=17`, `withVideoCacheBust`, `previewVideoSources`.
- Updated `src/components/site/CardMedia.test.tsx` and `src/lib/site/media-path.test.ts`.
- `CHANGELOG.md` entry.

## Key Insights
- Case pages use width/height, not `fill`. Fill stacking on `/work` cards already showed the still; non-fill previously returned the video alone, so a failed iOS paint was a black box.
- `galleryMediaItems` can drop `1-hero.jpg` when it is only the poster. That is fine if the video item itself carries the still underneath.

## Trade-offs Accepted
- Dual `<source>` tags and IntersectionObserver `play()` ship with the stacking fix so iOS can actually decode H.264. Scope stays in CardMedia + media-path helpers.

## Open Questions
- On-device Safari confirm after deploy (not this session).

## Next Steps
- [ ] Confirm `/work/[slug]` Screenshots on iPhone Safari after merge.
- [ ] Do not merge until that verify if fill-card PRs are still pending the same check.
