import { CASE_COPY } from "./case-copy";

/** Held back from the live /work catalog pending more craft time. Do not seed. */
export const HELD_BACK_PORTFOLIO_PROOFS = [
  "afterlight",
  "grove",
  "meridian",
  "energy-orb",
  "inner-green",
] as const;

export const PORTFOLIO_PROOF_SLUGS = [
  "working-volumes",
  "field-manuals",
  "betawise-earth",
  "sketchbook",
] as const;

export type PortfolioProofSlug = (typeof PORTFOLIO_PROOF_SLUGS)[number];

const NAMES: Record<PortfolioProofSlug, string> = {
  "working-volumes": "Working Volumes",
  "field-manuals": "Field Manuals",
  "betawise-earth": "Betawise Earth",
  sketchbook: "Sketchbook",
};

const TECH_STACK: Record<PortfolioProofSlug, string[]> = {
  "working-volumes": ["Three.js", "WebGL", "Next.js"],
  "field-manuals": ["Next.js", "CSS", "Three.js"],
  "betawise-earth": ["Three.js", "WebGL", "GLSL"],
  sketchbook: ["Next.js", "CSS"],
};

export type PortfolioProofRow = {
  slug: PortfolioProofSlug;
  name: string;
  description: string;
  problem: string;
  result: string;
  demoUrl: null;
  repoUrl: null;
  repoPath: null;
  techStack: string[];
  screenshots: string[];
  status: "live";
};

export function portfolioProofRow(slug: PortfolioProofSlug): PortfolioProofRow {
  const copy = CASE_COPY[slug];
  if (!copy) {
    throw new Error(`Missing CASE_COPY for ${slug}`);
  }
  return {
    slug,
    name: NAMES[slug],
    description: copy.description,
    problem: copy.problem,
    result: copy.result,
    demoUrl: null,
    repoUrl: null,
    repoPath: null,
    techStack: TECH_STACK[slug],
    screenshots: [`/screenshots/${slug}/preview.webm`, `/screenshots/${slug}/1-hero.jpg`],
    status: "live",
  };
}

export function allPortfolioProofRows(): PortfolioProofRow[] {
  return PORTFOLIO_PROOF_SLUGS.map(portfolioProofRow);
}
