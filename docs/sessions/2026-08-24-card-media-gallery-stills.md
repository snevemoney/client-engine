# Session: CardMedia gallery stills — 2026-08-24

## Goal
Fix case-study gallery stills on PR #23 (`cursor/card-media-fill-safari-17a0`). Non-video `src` was resolved through the next-sibling poster helper, so each still showed the following image and the last still became `.jpg` (404).

## Decisions Made
- Decision 1: Only call `resolvePosterSrc` when `isVideoPath(src)` is true. Gallery images use `src` unchanged.
- Decision 2: Video still layer is `poster || heroFromSrc` (`preview.(webm|mp4|mov)` → `1-hero.jpg`).
- Decision 3: Keep fill/Safari playback: no HTML `poster`, no `opacity-0`, MP4-first `<source>`, `?v=16` cache-bust, still-only fallback on `NETWORK_NO_SOURCE` only.

## What Was Built
- Modified `src/components/site/CardMedia.tsx` — stillSrc gated by video path; NETWORK_NO_SOURCE-only error fallback.
- Modified `src/lib/site/media-path.ts` — `PREVIEW_VIDEO_CACHE_BUST` `14` → `16`.
- Updated `src/components/site/CardMedia.test.tsx` — exact gallery src, last still not `.jpg`, no `poster=` attribute, NETWORK_NO_SOURCE fallback.
- Updated `src/lib/site/media-path.test.ts` — cache-bust `v=16`.

## Key Insights
- `resolvePosterSrc` is correct for a preview video (next still / `.jpg` fallback) and wrong for a gallery image (next sibling, or last-item `.jpg` 404).
- Case pages pass the full `screenshots[]` as `siblings` to every `CardMedia`, so the helper must not run on stills.

## Trade-offs Accepted
- Cache-bust bump (`v=16`) forces browsers to refetch preview files after this still-resolution change.

## Open Questions
- Safari on-device playback still needs confirmation before merge (same as PR #23).

## Next Steps
- [ ] Confirm fill-card playback on iOS Safari
- [ ] Do not merge until that verify
