# /work preview videos

Forge drops a muted Remotion render per live slug as:

```
public/screenshots/{slug}/preview.webm
```

Catalog rows keep media in `Project.screenshots` (no extra column). Live DB stores `preview.webm` first, still second. `CardMedia` derives `preview.mp4` from that path and offers MP4 then WebM (`<source>`), so Safari/iOS can play H.264. The still sits under the video (and stays if both files fail). Do not put the still on the HTML `poster` attribute — iOS Safari will stick on that frame.

Forge should also drop `preview.mp4` (H.264) next to `preview.webm` on the VPS.

Live slugs that expect a preview:

- working-volumes
- field-manuals
- betawise-earth
- sketchbook
- autoflow
- proof-qc-assist
- clearfield
- quickmarket

Do not commit large video binaries here. Leave existing stills in place.

Operator seed (does not deploy):

- Proofs (sets `[preview.webm, 1-hero.jpg]`): `npm run db:seed-portfolio-proofs`
- Product cards (prepends `preview.webm` only when missing): `npm run db:seed-work-preview-videos`
