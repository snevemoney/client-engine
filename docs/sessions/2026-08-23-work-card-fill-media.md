# Session: /work fill-card Safari video fix — 2026-08-23

## Goal
Fix public `/work` card fill media in `CardMedia.tsx` so preview videos actually play on iOS Safari. Source-only — no compiled-HTML hotpatch in the running container.

## Decisions Made
- Layer a still `<img>` under a fully visible `<video>` for fill cards and gallery videos.
- Never set HTML `poster` on fill/gallery videos. Safari treats poster as the painted frame and often never swaps to decoded video (Betawise looks frozen).
- Never start the video at `opacity-0` waiting for `onPlaying`. iOS will not decode, paint, or play a hidden video, so the card stays a still or goes black.
- Force `play()` when the video intersects the viewport (`IntersectionObserver`), with muted `playsInline` loop.
- Cache-bust preview `src` with `?v=12` (`withVideoCacheBust`) so replacement webms are not served from a stale cache. Leave an existing `v=` query alone.
- On `onError`, hide the video and keep the still only.
- Do not change public portfolio rules (no Source/GitHub, no localhost demos).

## What Was Built
- Modified `src/components/site/CardMedia.tsx` — layered still + visible video, in-view `play()`, no poster, no opacity-0.
- Modified `src/lib/site/media-path.ts` — `resolveCardStillSrc`, `withVideoCacheBust`, `PREVIEW_VIDEO_CACHE_BUST`.
- Updated `src/components/site/CardMedia.test.tsx` and `src/lib/site/media-path.test.ts`.
- Docs: `CHANGELOG.md`, `public/screenshots/README-previews.md`.

## Key Insights
- Two prior attempts failed for orthogonal Safari reasons: `poster` pins the still; `opacity-0` until `onPlaying` prevents playback from starting.
- Hotpatching `.next` HTML in the container cannot be the fix path — the next deploy overwrites it.

## Trade-offs Accepted
- Gallery videos use the same layered approach (they shared the poster attribute). Stills size the box; video is `absolute` on top.
- Videos stay `preload="metadata"`; `play()` when in view starts the fetch.

## Open Questions
- Whether Forge-replaced webms need a `PREVIEW_VIDEO_CACHE_BUST` bump beyond `12`.

## Next Steps
- [ ] Confirm Betawise and other fill cards play on iOS Safari after deploy.
- [ ] Bump `PREVIEW_VIDEO_CACHE_BUST` when new preview files land.
