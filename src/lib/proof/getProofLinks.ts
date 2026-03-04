/**
 * Get top 3 published proof page links, scored by tech stack overlap with lead.
 * Used to inject relevant social proof into proposal prompts.
 */

import { db } from "@/lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://evenslouis.ca";

/**
 * Score project by tech stack overlap with lead tech stack.
 * Returns overlap count. Higher = more relevant.
 */
function scoreOverlap(leadTech: string[], projectTech: string[]): number {
  const leadSet = new Set(leadTech.map((t) => t.toLowerCase().trim()));
  const projectSet = new Set(projectTech.map((t) => t.toLowerCase().trim()));
  let count = 0;
  for (const t of projectSet) {
    if (leadSet.has(t)) count++;
  }
  return count;
}

/**
 * Get markdown links to top 3 published proof pages, scored by tech stack relevance.
 * Returns empty string if no proof pages.
 */
export async function getProofLinks(leadId: string): Promise<string> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { techStack: true },
  });
  const leadTech = lead?.techStack ?? [];

  const projects = await db.project.findMany({
    where: { proofPublishedAt: { not: null } },
    select: {
      id: true,
      slug: true,
      proofHeadline: true,
      name: true,
      techStack: true,
    },
  });

  if (projects.length === 0) return "";

  const scored = projects.map((p) => ({
    project: p,
    score: scoreOverlap(leadTech, p.techStack ?? []),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return 0;
  });

  const top3 = scored.slice(0, 3);
  const lines = top3.map(({ project }) => {
    const title = project.proofHeadline ?? project.name;
    const url = `${APP_URL}/proof/${project.slug}`;
    return `- [${title}](${url})`;
  });

  return lines.length > 0
    ? `Relevant case studies:\n${lines.join("\n")}\n\nUse these to ground the proof bullets.`
    : "";
}
