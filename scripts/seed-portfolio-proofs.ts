/**
 * Idempotent upsert of public /work proof/concept cards.
 * Does not wipe existing projects (autoflow, clearfield, proof-qc-assist, quickmarket, …).
 *
 * Held back pending more craft time (do not add them here):
 * afterlight, grove, meridian, energy-orb, inner-green.
 *
 * Usage (staging/prod — operator only; this script does not deploy):
 *   DATABASE_URL="postgresql://…" npx tsx scripts/seed-portfolio-proofs.ts
 *
 * Usage inside the app container:
 *   docker exec -it client-engine-app npx tsx scripts/seed-portfolio-proofs.ts
 *
 * Screenshots: preview.webm first, 1-hero.jpg as poster. Forge drops the webms.
 * Requires DATABASE_URL. Safe to re-run. Always writes repoUrl/repoPath/demoUrl as null.
 */
import { db } from "../src/lib/db";
import {
  allPortfolioProofRows,
  HELD_BACK_PORTFOLIO_PROOFS,
} from "../src/lib/site/portfolio-proofs";

async function main() {
  for (const held of HELD_BACK_PORTFOLIO_PROOFS) {
    const existing = await db.project.findUnique({ where: { slug: held }, select: { id: true } });
    if (existing) {
      console.log(`Held back (not upserted): ${held}`);
    }
  }

  for (const data of allPortfolioProofRows()) {
    await db.project.upsert({
      where: { slug: data.slug },
      update: data,
      create: data,
    });
    console.log(`Upserted: ${data.name} (${data.slug})`);
  }

  console.log(
    "\nDone. Verify at /work — four new proof cards, no Source links, no private demos. Held-back slugs stay out."
  );
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
