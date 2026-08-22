# Session: Public /work card video playback (Safari/WebM) — 2026-08-22

## Goal
Fix public `/work` cards showing a still screenshot instead of the Remotion spin, especially Betawise Earth. Safari and some Chrome setups fail a lone `<video src="…/preview.webm">` (VP8), so `CardMedia` `onError` fell back to the poster.

## Decisions Made
- Prefer CardMedia resolving a sibling `preview.mp4` so existing DB rows that store `preview.webm` first keep working. No seed rewrite, no Prisma change.
- Dual `<source>` tags: MP4 first (`type="video/mp4"`), then WebM. Browsers that cannot decode VP8 pick H.264.
- Call muted `video.play().catch(() => {})` after mount so autoplay actually starts. Keep poster, muted, loop, playsInline, autoPlay.
- Do not cache-bust query strings; prefer correct Content-Type + the mp4 sibling.
- Forge should drop both `preview.mp4` and `preview.webm`. If mp4 is missing, the browser falls through to webm; if both fail, poster still.

## What Was Built
- `src/lib/site/media-path.ts` — `videoSourceCandidates()` (mp4 then webm; preserves query strings; lone `.mov` stays one source).
- `src/components/site/CardMedia.tsx` — `<source>` children instead of `src=`; ref + `useEffect` play attempt.
- Tests for dual sources, play attempt, stills, and poster fallback.
- Preview README + seed comments note the sibling mp4. CHANGELOG + ROADMAP updated.

## Key Insights
- `onError` on a single webm `src` is too eager: decode failure looks like a missing file and swaps to the hero still.
- Existing catalog rows do not need a re-seed for this to work, as long as Forge drops `preview.mp4` next to `preview.webm`.

## Trade-offs Accepted
- A 404 on the mp4 sibling is expected until Forge drops the file; the browser should try webm next. Video `onError` (poster fallback) only fires if every source fails.
- Product seed still prepends `preview.webm` only. CardMedia, not the DB, owns format fallback.

## Open Questions
- Confirm Forge H.264 mp4s are actually on the VPS for Betawise Earth and the other seven live slugs.

## Next Steps
- [ ] Operator merges and ships (this PR is not deployed from here).
- [ ] Forge drops `preview.mp4` + `preview.webm` per live slug if not already present.
- [ ] Spot-check `/work` on Safari: Betawise Earth should spin, not freeze on the hero still.
