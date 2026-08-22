# /work preview videos

Forge drops a muted Remotion render per live slug as:

```
public/screenshots/{slug}/preview.webm
```

Catalog rows keep media in `Project.screenshots` (no extra column). Video path first, still second so `CardMedia` can use the still as `poster` when the webm is missing or still loading.

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
