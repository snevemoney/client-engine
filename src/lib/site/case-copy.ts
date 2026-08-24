/** Honest /work case copy. Scored from code (WORK-AS-BUSINESSES-2026-08-14), not vault labels. */

export type CaseCopy = {
  description: string;
  problem: string;
  result: string;
  proofOnly?: boolean;
};

const STALE_LIES = [
  "approval pipelines",
  "save favorites",
  "automate without writing code",
  "truth emerges through open challenge",
  "managing and reviewing proof documents",
];

export const CASE_COPY: Record<string, CaseCopy> = {
  "proof-qc-assist": {
    description:
      "Quebec nursing / sciences infirmières — sources in, Verify Now (claims + interventions), report, then a login-gated final draft that keeps their voice. Not team proof-docs, not Clearfield, not approval pipelines.",
    problem:
      "Nursing students need to check care-plan and assignment claims against sources before they file a final draft.",
    result:
      "Working demo: FR/EN, upload, Verify Now, readiness bar, history, login-gated final draft. No public URL and no Stripe yet.",
  },
  quickmarket: {
    description:
      "Local classifieds: create a listing, demo $5 pay-to-publish (no live Stripe), public grid, message the seller. Client-side search and filter. No favorites.",
    problem:
      "Sellers need a simple local listing grid; buyers reach sellers by message, then pay offline.",
    result:
      "Auth, listing CRUD, image upload, client filter, seller dashboard, inbox, paid_demo RLS. The $5 gate is demo-only.",
  },
  clearfield: {
    description:
      "Civic/OSINT workbench that structures claims and evidence. Contradiction scan and viz are demo-heavy. Does not adjudicate truth. Not ProofCheck.",
    problem:
      "Investigative work needs structured claims, evidence, and unknowns — not a truth engine.",
    result:
      "Dashboard, claims/evidence CRUD, contradiction scan, document search. Auth page is UI-only. Not a sold SKU this cycle.",
  },
  autoflow: {
    description:
      "Proof / concept — UI screenshots of a visual-editor idea. No app, no repo, no product. Not autoflow-finance.",
    problem: "Show the install-agency look of a workflow builder without shipping a product.",
    result: "Proof only. Screenshots, no shipped app.",
    proofOnly: true,
  },
  "working-volumes": {
    description:
      "Proof / concept — a shelf of field guides. Product-shelf interaction craft. No app, no repo, no product.",
    problem: "Show a tactile shelf of volumes without shipping a product.",
    result: "Proof only. Screenshots of the shelf, no shipped app.",
    proofOnly: true,
  },
  "field-manuals": {
    description:
      "Proof / concept — harbour, ravine, and studio desk manuals. Tactile UI storytelling. No app, no repo, no product.",
    problem: "Show desk-side manuals you can take without shipping a product.",
    result: "Proof only. Screenshots of the collection, no shipped app.",
    proofOnly: true,
  },
  "betawise-earth": {
    description:
      "Proof / concept — a spinning earth with terminator and sun. Dynamic earth shader. No app, no repo, no product.",
    problem: "Show a living earth shader without shipping a product.",
    result: "Proof only. Screenshots of the earth, no shipped app.",
    proofOnly: true,
  },
  sketchbook: {
    description:
      "Proof / concept — a desk-book site you turn. Editorial web craft. No app, no repo, no product.",
    problem: "Show a site that feels like a book you already keep, without shipping a product.",
    result: "Proof only. Screenshots of the pages, no shipped app.",
    proofOnly: true,
  },
  "outer-heaven-landing": {
    description:
      "Proof / concept — a landing with blue orbs. Static landing craft. No app, no repo, no product.",
    problem: "Show a blue-orb landing without shipping a product.",
    result: "Proof only. Screenshots of the landing, no shipped app.",
    proofOnly: true,
  },
  "northline-clinic": {
    description:
      "Proof / concept — a clinic landing with a teal ribbon. Static landing craft. No app, no repo, no product.",
    problem: "Show a med-spa/dental landing with a teal ribbon without shipping a product.",
    result: "Proof only. Screenshots of the landing, no shipped app.",
    proofOnly: true,
  },
  "harbor-and-co": {
    description:
      "Proof / concept — a trades landing with an amber grid-drift. Static landing craft. No app, no repo, no product.",
    problem: "Show a trades landing with an amber grid without shipping a product.",
    result: "Proof only. Screenshots of the landing, no shipped app.",
    proofOnly: true,
  },
  ledgerline: {
    description:
      "Proof / concept — a B2B SaaS landing with blue orbs. Static landing craft. No app, no repo, no product.",
    problem: "Show a B2B SaaS landing with blue orbs without shipping a product.",
    result: "Proof only. Screenshots of the landing, no shipped app.",
    proofOnly: true,
  },
  "atelier-cohort": {
    description:
      "Proof / concept — a coaching landing with a rose ribbon. Static landing craft. No app, no repo, no product.",
    problem: "Show a coaching landing with a rose ribbon without shipping a product.",
    result: "Proof only. Screenshots of the landing, no shipped app.",
    proofOnly: true,
  },
  "quay-team": {
    description:
      "Proof / concept — a real-estate landing with a teal grid-drift. Static landing craft. No app, no repo, no product.",
    problem: "Show a real-estate landing with a teal grid without shipping a product.",
    result: "Proof only. Screenshots of the landing, no shipped app.",
    proofOnly: true,
  },
  "ashford-and-vale": {
    description:
      "Proof / concept — a law landing with blue particles. Static landing craft. No app, no repo, no product.",
    problem: "Show a law landing with blue particles without shipping a product.",
    result: "Proof only. Screenshots of the landing, no shipped app.",
    proofOnly: true,
  },
  "ironlane-studio": {
    description:
      "Proof / concept — a fitness landing with amber particles. Static landing craft. No app, no repo, no product.",
    problem: "Show a fitness landing with amber particles without shipping a product.",
    result: "Proof only. Screenshots of the landing, no shipped app.",
    proofOnly: true,
  },
};

export function isStaleCaseDescription(description: string | null | undefined): boolean {
  if (!description) return false;
  const lower = description.toLowerCase();
  return STALE_LIES.some((lie) => lower.includes(lie));
}

export function resolveCaseCopy(project: {
  slug: string;
  description?: string | null;
  problem?: string | null;
  result?: string | null;
}): CaseCopy {
  const fallback = CASE_COPY[project.slug];
  const dbDescription = project.description?.trim() || "";
  const description =
    dbDescription && !isStaleCaseDescription(dbDescription)
      ? dbDescription
      : (fallback?.description ?? dbDescription);
  return {
    description,
    problem: project.problem?.trim() || fallback?.problem || "—",
    result: project.result?.trim() || fallback?.result || "—",
    proofOnly: fallback?.proofOnly ?? false,
  };
}
