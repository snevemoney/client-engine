/**
 * Additive prepend of /screenshots/{slug}/preview.webm on the four product
 * /work cards. Does not wipe other screenshot paths. Does not touch proofs
 * (those come from seed-portfolio-proofs).
 *
 * Usage (staging/prod — operator only; this script does not deploy):
 *   DATABASE_URL="postgresql://…" npx tsx scripts/seed-work-preview-videos.ts
 *
 * Usage inside the app container:
 *   docker exec -it client-engine-app npx tsx scripts/seed-work-preview-videos.ts
 *
 * Requires DATABASE_URL. Safe to re-run.
 */
import { db } from "../src/lib/db";
import {
  prependPreviewWebm,
  PRODUCT_WORK_PREVIEW_SLUGS,
  workPreviewPath,
} from "../src/lib/site/media-path";

async function main() {
  for (const slug of PRODUCT_WORK_PREVIEW_SLUGS) {
    const project = await db.project.findUnique({
      where: { slug },
      select: { name: true, screenshots: true },
    });
    if (!project) {
      console.log(`Skip (not found): ${slug}`);
      continue;
    }

    const next = prependPreviewWebm(project.screenshots, slug);
    if (next === project.screenshots) {
      console.log(`Unchanged: ${project.name} (${slug})`);
      continue;
    }

    await db.project.update({
      where: { slug },
      data: { screenshots: next },
    });
    console.log(`Prepended ${workPreviewPath(slug)}: ${project.name} (${slug})`);
  }

  console.log(
    "\nDone. Product cards now list preview.webm first when missing. Existing stills stay. Proofs use db:seed-portfolio-proofs."
  );
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
