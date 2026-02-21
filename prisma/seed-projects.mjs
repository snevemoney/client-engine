import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const projects = [
  {
    slug: "quickmarket",
    name: "QuickMarket",
    description:
      "A local classifieds marketplace built with React, TypeScript, and Supabase. Features user authentication, listing creation with image uploads, real-time search and filtering, category browsing, and a responsive mobile-first design. Sellers can manage their listings while buyers can browse, save favorites, and contact sellers directly.",
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
      "An open civic intelligence and evidence platform for managing claims, evidence objects, and investigative workflows. Features a real-time intel dashboard with stats tracking, case file management, evidence annotations, timeline visualization, graph-based relationship mapping, and a search interface. Built for credibility through structure — users submit evidence and truth emerges through open challenge.",
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
      "A quality control assistant application for managing and reviewing proof documents. Features a project workspace with sidebar navigation, multi-language support, authentication, and a structured QC workflow. Designed for teams that need systematic document review with error tracking, annotation capabilities, and approval pipelines.",
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
      "Workflow and automation platform for building and running flows. Visual editor, triggers, steps, and run history — so teams can automate without writing code.",
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
