/**
 * Strategy Quadrant AI fill: infer weekly strategy fields from operator context.
 * Used by POST /api/ops/strategy-week/ai-fill and strategy_week_ai_fill job.
 */

import { db } from "@/lib/db";
import { getOperatorSettings } from "@/lib/ops/settings";
import { getWeekStart } from "@/lib/ops/strategyWeek";
import { chat } from "@/lib/llm";

const PHASES = ["survival", "formulation", "explosion", "plateau"] as const;

export type StrategyWeekAiFillResult = {
  phase: string | null;
  activeCampaignName: string | null;
  activeCampaignAudience: string | null;
  activeCampaignChannel: string | null;
  activeCampaignOffer: string | null;
  activeCampaignCta: string | null;
  activeCampaignProof: string | null;
  operatorImprovementFocus: string | null;
  salesTarget: string | null;
  theme: string | null;
  monthlyFocus: string | null;
  weeklyTargetValue: number | null;
  weeklyTargetUnit: string | null;
  declaredCommitment: string | null;
  keyMetric: string | null;
  keyMetricTarget: string | null;
  biggestBottleneck: string | null;
  missionStatement: string | null;
  whyThisWeekMatters: string | null;
  dreamStatement: string | null;
  fuelStatement: string | null;
  prioritySuggestions: string[];
};

function parseJsonFromContent(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/m);
  const raw = fence ? fence[1]?.trim() ?? trimmed : trimmed;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function gatherContext(): Promise<{
  operatorSettings: Awaited<ReturnType<typeof getOperatorSettings>>;
  recentWeeks: Array<{
    weekStart: string;
    phase: string | null;
    activeCampaignName: string | null;
    operatorImprovementFocus: string | null;
    salesTarget: string | null;
    biggestBottleneck: string | null;
  }>;
  pipelineMetrics: {
    intakeTotal: number;
    qualified: number;
    sent: number;
    won: number;
    wonThisWeek: number;
    pipelineLeads: number;
    pipelineWon: number;
  };
}> {
  const weekStart = getWeekStart();
  const weekStartDate = new Date(weekStart);
  weekStartDate.setDate(weekStartDate.getDate() - 28);

  const [operatorSettings, recentWeeks, intakeSummary, pipelineCounts] = await Promise.all([
    getOperatorSettings(),
    db.strategyWeek.findMany({
      where: { weekStart: { gte: weekStartDate } },
      orderBy: { weekStart: "desc" },
      take: 4,
      include: { review: true },
    }),
    db.intakeLead.count(),
    Promise.all([
      db.intakeLead.count({ where: { status: "qualified" } }),
      db.intakeLead.count({ where: { status: "sent" } }),
      db.intakeLead.count({ where: { status: "won" } }),
      db.intakeLead.count({
        where: { status: "won", updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      db.lead.count({ where: { status: { not: "REJECTED" } } }),
      db.lead.count({ where: { dealOutcome: "won" } }),
    ]),
  ]);

  const [qualified, sent, won, wonThisWeek, pipelineLeads, pipelineWon] = pipelineCounts;

  return {
    operatorSettings,
    recentWeeks: recentWeeks.map((r) => ({
      weekStart: r.weekStart.toISOString(),
      phase: r.phase,
      activeCampaignName: r.activeCampaignName,
      operatorImprovementFocus: r.operatorImprovementFocus,
      salesTarget: r.salesTarget,
      biggestBottleneck: r.review?.biggestBottleneck ?? null,
    })),
    pipelineMetrics: {
      intakeTotal: intakeSummary,
      qualified,
      sent,
      won,
      wonThisWeek,
      pipelineLeads,
      pipelineWon,
    },
  };
}

export async function inferStrategyWeekFields(): Promise<StrategyWeekAiFillResult> {
  const ctx = await gatherContext();

  const prompt = `You are a strategic planning assistant for an operator running a small service business. Infer suggested values for their weekly Strategy Quadrant from the context below.

Operator context:
- Niche: ${ctx.operatorSettings.nicheStatement ?? "(not set)"}
- Offer: ${ctx.operatorSettings.offerStatement ?? "(not set)"}
- Scoring profile: ${JSON.stringify(ctx.operatorSettings.scoringProfile ?? {})}

Pipeline metrics:
- Intake: ${ctx.pipelineMetrics.intakeTotal} total, ${ctx.pipelineMetrics.qualified} qualified, ${ctx.pipelineMetrics.sent} sent, ${ctx.pipelineMetrics.won} won
- Pipeline leads: ${ctx.pipelineMetrics.pipelineLeads}, won: ${ctx.pipelineMetrics.pipelineWon}
- Won this week: ${ctx.pipelineMetrics.wonThisWeek}

Recent strategy weeks (most recent first):
${JSON.stringify(ctx.recentWeeks, null, 2)}

Return ONLY a JSON object with these keys. Use null or omit if you cannot infer. Be specific and actionable—tie suggestions to their niche, offer, and recent bottlenecks. No hype, no cold outreach language. Observational and fit-focused.

Phases: survival (cash flow focus), formulation (testing offer/audience), explosion (scaling what works), plateau (optimizing, not growing).

Campaign: name, audience, channel, offer, CTA, proof angle—all should align with their niche and offer.

Operator improvement: one concrete system/leverage improvement for the week.

Sales target: e.g. "10 follow-ups / 2 calls" or "3 proposals sent".

Logic: theme, monthlyFocus, weeklyTargetValue (number), weeklyTargetUnit, declaredCommitment, keyMetric, keyMetricTarget, biggestBottleneck (anticipated).

Emotion: missionStatement (1-2 sentences), whyThisWeekMatters, dreamStatement, fuelStatement (problem to beat / motivation).

prioritySuggestions: array of 2-4 short priority titles (e.g. "Draft proposal for Acme", "Ship audit campaign").

{
  "phase": "survival|formulation|explosion|plateau",
  "activeCampaignName": "...",
  "activeCampaignAudience": "...",
  "activeCampaignChannel": "...",
  "activeCampaignOffer": "...",
  "activeCampaignCta": "...",
  "activeCampaignProof": "...",
  "operatorImprovementFocus": "...",
  "salesTarget": "...",
  "theme": "...",
  "monthlyFocus": "...",
  "weeklyTargetValue": 10,
  "weeklyTargetUnit": "calls",
  "declaredCommitment": "...",
  "keyMetric": "...",
  "keyMetricTarget": "...",
  "biggestBottleneck": "...",
  "missionStatement": "...",
  "whyThisWeekMatters": "...",
  "dreamStatement": "...",
  "fuelStatement": "...",
  "prioritySuggestions": ["...", "..."]
}

No markdown fences, just JSON.`;

  const { content } = await chat(
    [
      { role: "system", content: "You are a strategic planning assistant. Return only valid JSON. No markdown." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.4, max_tokens: 1536 }
  );

  const raw = parseJsonFromContent(content ?? "");
  if (!raw) {
    throw new Error("AI response was not valid JSON");
  }

  const phase =
    typeof raw.phase === "string" && PHASES.includes(raw.phase as (typeof PHASES)[number])
      ? raw.phase
      : null;

  const str = (v: unknown, max = 500): string | null =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };

  const arr = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 6);
  };

  return {
    phase,
    activeCampaignName: str(raw.activeCampaignName, 500),
    activeCampaignAudience: str(raw.activeCampaignAudience, 500),
    activeCampaignChannel: str(raw.activeCampaignChannel, 500),
    activeCampaignOffer: str(raw.activeCampaignOffer, 500),
    activeCampaignCta: str(raw.activeCampaignCta, 500),
    activeCampaignProof: str(raw.activeCampaignProof, 500),
    operatorImprovementFocus: str(raw.operatorImprovementFocus, 1000),
    salesTarget: str(raw.salesTarget, 500),
    theme: str(raw.theme, 200),
    monthlyFocus: str(raw.monthlyFocus, 500),
    weeklyTargetValue: num(raw.weeklyTargetValue),
    weeklyTargetUnit: str(raw.weeklyTargetUnit, 100),
    declaredCommitment: str(raw.declaredCommitment, 1000),
    keyMetric: str(raw.keyMetric, 500),
    keyMetricTarget: str(raw.keyMetricTarget, 500),
    biggestBottleneck: str(raw.biggestBottleneck, 500),
    missionStatement: str(raw.missionStatement, 500),
    whyThisWeekMatters: str(raw.whyThisWeekMatters, 500),
    dreamStatement: str(raw.dreamStatement, 500),
    fuelStatement: str(raw.fuelStatement, 500),
    prioritySuggestions: arr(raw.prioritySuggestions),
  };
}
