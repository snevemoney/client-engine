import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { chat, type ChatUsage } from "@/lib/llm";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";
import { isDryRun } from "@/lib/pipeline/dry-run";
import { getOperatorSettings } from "@/lib/ops/settings";

/** Source bonus for pipeline scoring — higher intent channels get a small boost (0–10). */
const SOURCE_BONUS: Record<string, number> = {
  inbound: 10,
  referral: 10,
  upwork: 8,
  coach_prospect: 4,
  reddit: 4,
  twitter: 4,
  linkedin: 6,
  research: 2,
  rss: 2,
  manual: 0,
};

function getSourceBonus(source: string): number {
  const normalized = source?.toLowerCase().replace(/\s+/g, "_") ?? "";
  return SOURCE_BONUS[normalized] ?? SOURCE_BONUS[normalized.split("_")[0]] ?? 0;
}

const DEFAULT_PROFILE = {
  idealProjects: "websites, landing pages, web apps, dashboards, marketing sites, course platforms",
  budgetRange: "$1,000-$10,000",
  typicalTimeline: "1-4 weeks",
  techStack: "Next.js, React, WordPress, Squarespace, and other web platforms",
  prefers: "clear scope, responsive clients, repeat potential",
  avoids: "scams, fraud, obviously unrealistic expectations",
};

function buildScorePrompt(profile: typeof DEFAULT_PROFILE): string {
  return `You are a lead scoring engine for a freelance developer who does web work.

Profile:
- Projects: ${profile.idealProjects}
- Typical budget: ${profile.budgetRange}
- Typical timeline: ${profile.typicalTimeline}
- Tech: ${profile.techStack}
- Prefers: ${profile.prefers}
- Avoids: ${profile.avoids}

Lead to score:
Title: {title}
Source: {source}
Budget: {budget}
Timeline: {timeline}
Platform: {platform}
Tech Stack: {techStack}
Description: {description}

Score this lead from 0-100. Be generous—leads are opportunities to qualify, not to filter out. The developer can adapt to different tech stacks (WordPress, Squarespace, custom, etc.). Websites and landing pages are valid work.

Rules:
- Missing budget/scope/tech = neutral, not a penalty.
- Tech stack mismatch (e.g. WordPress vs React) = minor, not disqualifying. Developers can work across stacks.
- Reserve REJECT only for scams, fraud, or obviously unrealistic requests (e.g. "build Facebook for $50").
- When unsure, use MAYBE and score 50-70. Default to giving the benefit of the doubt.
- Scores below 30 should be rare—only for clear red flags.

Return ONLY a JSON object with:
- score: number 0-100
- verdict: "ACCEPT" or "MAYBE" or "REJECT"
- factors: object with optional keys budgetFit, scopeClarity, techAlignment, effortReward, redFlags (each 0-2)
- reasons: array of 3-5 short reason strings explaining the score
- suggestion: one sentence about how to approach this lead

No markdown fences, just JSON.`;
}

export async function runScore(leadId: string): Promise<{ usage?: ChatUsage }> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  if (isDryRun()) {
    await db.lead.update({
      where: { id: leadId },
      data: {
        score: 50,
        scoreReason: "**[DRY RUN]** Placeholder score.",
        scoreVerdict: null,
        scoreFactors: Prisma.DbNull,
        status: lead.status === "NEW" || lead.status === "ENRICHED" ? "SCORED" : lead.status,
        scoredAt: new Date(),
      },
    });
    return {};
  }

  const settings = await getOperatorSettings();
  const sp = settings.scoringProfile ?? {};
  const profile = {
    idealProjects: sp.idealProjects ?? DEFAULT_PROFILE.idealProjects,
    budgetRange: sp.budgetRange ?? DEFAULT_PROFILE.budgetRange,
    typicalTimeline: sp.typicalTimeline ?? DEFAULT_PROFILE.typicalTimeline,
    techStack: sp.techStack ?? DEFAULT_PROFILE.techStack,
    prefers: sp.prefers ?? DEFAULT_PROFILE.prefers,
    avoids: sp.avoids ?? DEFAULT_PROFILE.avoids,
  };

  const promptTemplate = buildScorePrompt(profile);
  const prompt = promptTemplate
    .replace("{title}", lead.title)
    .replace("{source}", lead.source)
    .replace("{budget}", lead.budget || "Not specified")
    .replace("{timeline}", lead.timeline || "Not specified")
    .replace("{platform}", lead.platform || "Not specified")
    .replace("{techStack}", lead.techStack?.join?.(", ") || "Not specified")
    .replace("{description}", lead.description || "No description");

  const { content, usage } = await chat(
    [
      { role: "system", content: "You are a lead scoring engine. Be generous—default to MAYBE when unsure. Reserve REJECT only for clear red flags. Return only valid JSON." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.2, max_tokens: 512 }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scored = safeParseJSON(content) as any;
  let rawScore = typeof scored.score === "number" ? scored.score : parseInt(String(scored.score), 10) || 50;
  rawScore = Math.min(100, Math.max(0, rawScore));

  const sourceBonus = getSourceBonus(lead.source);
  const finalScore = Math.min(100, Math.max(0, rawScore + sourceBonus));

  const verdict = ["ACCEPT", "MAYBE", "REJECT"].includes(scored.verdict) ? scored.verdict : null;
  const factors = scored.factors && typeof scored.factors === "object" ? scored.factors : null;

  const scoreReason = [
    `**Verdict:** ${verdict ?? scored.verdict ?? "—"}`,
    `**Score:** ${finalScore}/100${sourceBonus > 0 ? ` (base ${rawScore} + ${sourceBonus} source)` : ""}`,
    "",
    "**Reasons:**",
    ...(scored.reasons || []).map((r: string) => `- ${r}`),
    "",
    `**Suggestion:** ${scored.suggestion ?? "—"}`,
  ].join("\n");

  await db.lead.update({
    where: { id: leadId },
    data: {
      score: finalScore,
      scoreReason,
      scoreVerdict: verdict,
      scoreFactors: factors != null ? (factors as Prisma.InputJsonValue) : Prisma.DbNull,
      status: lead.status === "NEW" || lead.status === "ENRICHED" ? "SCORED" : lead.status,
      scoredAt: new Date(),
    },
  });

  return { usage };
}
