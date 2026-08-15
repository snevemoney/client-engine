/**
 * Seed portfolio projects for /work page.
 * Run: npm run db:seed-projects
 * Requires NODE_ENV=development or SEED_DEMO_DATA=1 — blocks accidental prod use.
 * Do not set demoUrl unless a real public URL already exists.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function isDevOrExplicit() {
  const env = process.env.NODE_ENV;
  const explicit = process.env.SEED_DEMO_DATA === "1" || process.env.SEED_DEMO_DATA === "true";
  return env === "development" || explicit;
}

// ── Archived slugs ──────────────────────────────────────────────────
// These were past leads, never real website builds.
// They must NOT be re-seeded as public projects.
//   - "emmanuelle-vandepitterie-*" (archived via apply-work-portfolio-update.mjs)

const projects = [
  {
    slug: "ai-partner-os",
    name: "AI Partner OS",
    description:
      "Multi-agent Grok Bot operator OS with 17 specialists for acquire/grow/cut outcomes. Morning brief, human-in-the-loop approvals, audits that become agents that become retainers.",
    repoUrl: null,
    techStack: ["Grok Bot", "Cursor", "n8n", "TypeScript", "Telegram"],
    status: "live",
    screenshots: [],
  },
  {
    slug: "cinematic-ai-partner",
    name: "Cinematic AI Partner",
    description:
      "Marketing and proof site for AI Partner positioning on evenslouis.ca. Cinematic landing page, work proofs gallery, and workflow audit CTA.",
    repoUrl: null,
    demoUrl: "https://evenslouis.ca",
    techStack: ["Next.js", "TypeScript", "Tailwind CSS"],
    status: "live",
    screenshots: [],
  },
  {
    slug: "report-creator",
    name: "Report Creator",
    description:
      "Self-contained HTML client and ops reports published at evenslouis.ca/reports/<slug> for instant sharing. Part of the Publishing Engine lane.",
    repoUrl: null,
    techStack: ["HTML", "Next.js", "TypeScript"],
    status: "live",
    screenshots: [],
  },
  {
    slug: "quickmarket",
    name: "QuickMarket",
    description:
      "Local classifieds: create a listing, demo $5 pay-to-publish (no live Stripe), public grid, message the seller. Client-side search and filter. No favorites.",
    problem:
      "Sellers need a simple local listing grid; buyers reach sellers by message, then pay offline.",
    result:
      "Auth, listing CRUD, image upload, client filter, seller dashboard, inbox, paid_demo RLS. The $5 gate is demo-only.",
    repoUrl: "https://github.com/snevemoney/quick-list-hub-42",
    techStack: ["React", "TypeScript", "Supabase", "Tailwind CSS", "Vite", "TanStack Query"],
    status: "live",
    screenshots: [
      "/screenshots/quickmarket/1-homepage.png",
      "/screenshots/quickmarket/2-listings.png",
      "/screenshots/quickmarket/3-menu.png",
      "/screenshots/quickmarket/4-listing-detail.png",
      "/screenshots/quickmarket/5-auth.png",
    ],
  },
  {
    slug: "clearfield",
    name: "Clearfield Evidence Flow",
    description:
      "Civic/OSINT workbench that structures claims and evidence. Contradiction scan and viz are demo-heavy. Does not adjudicate truth. Not ProofCheck.",
    problem:
      "Investigative work needs structured claims, evidence, and unknowns — not a truth engine.",
    result:
      "Dashboard, claims/evidence CRUD, contradiction scan, document search. Auth page is UI-only. Not a sold SKU this cycle.",
    repoUrl: "https://github.com/snevemoney/clearfield-evidence-flow",
    techStack: ["React", "TypeScript", "Supabase", "Tailwind CSS", "Framer Motion", "Recharts"],
    status: "live",
    screenshots: [
      "/screenshots/clearfield/1-dashboard.png",
      "/screenshots/clearfield/2-casefile.png",
      "/screenshots/clearfield/3-visualize.png",
      "/screenshots/clearfield/4-timeline.png",
      "/screenshots/clearfield/5-search.png",
    ],
  },
  {
    slug: "proof-qc-assist",
    name: "ProofCheck QC",
    description:
      "Quebec nursing / sciences infirmières — sources in, Verify Now (claims + interventions), report, then a login-gated final draft that keeps their voice. Not team proof-docs, not Clearfield, not approval pipelines.",
    problem:
      "Nursing students need to check care-plan and assignment claims against sources before they file a final draft.",
    result:
      "Working demo: FR/EN, upload, Verify Now, readiness bar, history, login-gated final draft. No public URL and no Stripe yet.",
    repoUrl: "https://github.com/snevemoney/proof-qc-assist",
    techStack: ["React", "TypeScript", "Supabase", "Tailwind CSS", "shadcn/ui"],
    status: "live",
    screenshots: [
      "/screenshots/proof-qc-assist/1-workspace.png",
      "/screenshots/proof-qc-assist/2-projects.png",
      "/screenshots/proof-qc-assist/3-review.png",
      "/screenshots/proof-qc-assist/4-annotations.png",
      "/screenshots/proof-qc-assist/5-report.png",
    ],
  },
  {
    slug: "autoflow",
    name: "Autoflow",
    description:
      "Proof / concept — UI screenshots of a visual-editor idea. No app, no repo, no product. Not autoflow-finance.",
    problem: "Show the install-agency look of a workflow builder without shipping a product.",
    result: "Proof only. Screenshots, no shipped app.",
    repoUrl: null,
    techStack: [],
    status: "live",
    screenshots: [
      "/screenshots/autoflow/1-dashboard.png",
      "/screenshots/autoflow/2-workflows.png",
      "/screenshots/autoflow/3-editor.png",
      "/screenshots/autoflow/4-runs.png",
      "/screenshots/autoflow/5-settings.png",
    ],
  },
];

async function main() {
  if (!isDevOrExplicit()) {
    console.error("db:seed-projects is for dev/demo only. Set NODE_ENV=development or SEED_DEMO_DATA=1 to run.");
    process.exit(1);
  }

  for (const p of projects) {
    const existing = await db.project.findUnique({ where: { slug: p.slug } });
    if (existing) {
      await db.project.update({ where: { slug: p.slug }, data: p });
      console.log(`Updated: ${p.name}`);
    } else {
      await db.project.create({ data: p });
      console.log(`Created: ${p.name}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
