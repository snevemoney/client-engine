/**
 * Phase 1.1: Heuristic scoring for IntakeLead (0–100).
 * Manual-first, no external AI. Upgradable when AI available.
 */
import type { IntakeLeadSource, IntakeLeadUrgency } from "@prisma/client";

export interface ScoreInput {
  source: IntakeLeadSource;
  title: string;
  company: string | null;
  summary: string;
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: IntakeLeadUrgency;
}

export interface ScoreResult {
  score: number;
  scoreReason: string;
}

const FIT_KEYWORDS = [
  "website",
  "automation",
  "ai",
  "funnel",
  "ads",
  "operations",
  "workflow",
  "tool",
  "software",
  "app",
  "integration",
  "process",
  "efficiency",
  "automate",
  "sistema",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export function scoreIntakeLead(input: ScoreInput): ScoreResult {
  const { source, title, company, summary, budgetMin, budgetMax, urgency } = input;
  const bullets: string[] = [];
  let score = 50; // base

  // Source match (upwork/linkedin/inbound tend to be higher intent)
  const sourceScores: Record<string, number> = {
    inbound: 15,
    referral: 12,
    upwork: 10,
    linkedin: 8,
    rss: 2,
    other: 0,
  };
  const sBonus = sourceScores[source] ?? 0;
  score += sBonus;
  if (sBonus > 0) bullets.push(`Source: ${source} (higher-intent channel)`);

  // Budget presence
  const hasBudget = budgetMin != null || budgetMax != null;
  if (hasBudget) {
    score += 12;
    bullets.push("Budget indicated");
  }

  // Summary quality (length as proxy)
  const summaryLen = (summary ?? "").length;
  if (summaryLen >= 200) {
    score += 8;
    bullets.push("Detailed summary");
  } else if (summaryLen >= 80) {
    score += 4;
    bullets.push("Reasonable summary length");
  }

  // Urgency
  const urgencyBonus = urgency === "high" ? 8 : urgency === "medium" ? 4 : 0;
  if (urgencyBonus > 0) bullets.push(`Urgency: ${urgency}`);
  score += urgencyBonus;

  // Keyword fit
  const combined = normalize([title, company ?? "", summary].join(" "));
  const matches = FIT_KEYWORDS.filter((kw) => combined.includes(kw));
  const kwBonus = Math.min(matches.length * 3, 12);
  score += kwBonus;
  if (matches.length > 0) bullets.push(`Fit keywords: ${matches.slice(0, 4).join(", ")}`);

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const reason =
    bullets.length > 0
      ? bullets.join(". ")
      : "Minimal signal. Add budget, more summary, or clearer fit keywords.";

  return { score: finalScore, scoreReason: reason };
}
