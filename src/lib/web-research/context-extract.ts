import { z } from "zod";
import { chat } from "@/lib/llm";
import { safeParseJSON } from "@/lib/llm/safe-parse-json";

const EXTRACT_OPTS = { model: "gpt-4o-mini", temperature: 0.2, max_tokens: 1500 } as const;

// ── Knowledge ──

const KnowledgeExtractSchema = z.object({
  insightText: z.string(),
  kind: z.enum(["principle", "tactical", "warning", "metricsIdea", "bottleneckIdea"]),
  categories: z.array(
    z.enum(["sales", "ops", "marketing", "delivery", "offer", "automation", "constraint", "mindset"]),
  ).min(1).max(3),
  tags: z.array(z.string()).max(5),
  confidence: z.number().min(0).max(1),
});

export type KnowledgeExtract = z.infer<typeof KnowledgeExtractSchema>;

export async function extractForKnowledge(title: string, content: string): Promise<KnowledgeExtract> {
  const { content: raw } = await chat(
    [
      {
        role: "system",
        content: `You extract a single atomic knowledge insight from research briefs. Return ONLY valid JSON, no markdown fences.`,
      },
      {
        role: "user",
        content: `Extract the most important insight from this research brief.

Title: ${title}
Brief:
${content.slice(0, 3000)}

Return JSON:
{
  "insightText": "1-3 sentence atomic insight — the single most important takeaway",
  "kind": "principle|tactical|warning|metricsIdea|bottleneckIdea",
  "categories": ["1-3 of: sales|ops|marketing|delivery|offer|automation|constraint|mindset"],
  "tags": ["topic tags for searchability"],
  "confidence": 0.0-1.0
}

Rules:
- "kind" = principle (durable truth), tactical (concrete step), warning (risk/anti-pattern), metricsIdea (KPI to track), bottleneckIdea (constraint found)
- "categories" = which business areas this insight applies to
- Keep insightText tight — one atomic idea, not a summary of everything
- Return ONLY valid JSON.`,
      },
    ],
    EXTRACT_OPTS,
  );

  return KnowledgeExtractSchema.parse(safeParseJSON(raw));
}

// ── Learning ──

const LearningExtractSchema = z.object({
  title: z.string(),
  insightType: z.enum(["sales", "ops", "marketing", "finance", "product", "mindset", "positioning", "metrics"]),
  problemObserved: z.string(),
  principle: z.string(),
  proposedChange: z.string(),
  expectedImpact: z.string(),
  effort: z.enum(["low", "med", "high"]),
  risk: z.enum(["low", "med", "high"]),
  metricToTrack: z.string().optional(),
  applyTarget: z.enum(["prompt", "workflow", "ui", "scorecard", "playbook", "automation"]).optional(),
});

export type LearningExtract = z.infer<typeof LearningExtractSchema>;

export async function extractForLearning(title: string, content: string): Promise<LearningExtract> {
  const { content: raw } = await chat(
    [
      {
        role: "system",
        content: `You extract improvement proposals from research briefs. The proposals are for a solo operator's business engine (sales pipeline, delivery ops, marketing automation). Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Extract an improvement proposal from this research brief.

Title: ${title}
Brief:
${content.slice(0, 3000)}

Return JSON:
{
  "title": "short action title (5-10 words)",
  "insightType": "sales|ops|marketing|finance|product|mindset|positioning|metrics",
  "problemObserved": "what problem or gap does this research reveal?",
  "principle": "the underlying principle or framework",
  "proposedChange": "exactly what to change in the business/system",
  "expectedImpact": "what measurably improves if applied",
  "effort": "low|med|high",
  "risk": "low|med|high",
  "metricToTrack": "optional — how to know it worked",
  "applyTarget": "prompt|workflow|ui|scorecard|playbook|automation"
}

Rules:
- proposedChange should be specific and actionable, not vague
- effort/risk are relative to a solo operator (not an enterprise team)
- Return ONLY valid JSON.`,
      },
    ],
    EXTRACT_OPTS,
  );

  return LearningExtractSchema.parse(safeParseJSON(raw));
}

// ── Strategy ──

const StrategyExtractSchema = z.object({
  operatorImprovementFocus: z.string().optional(),
  biggestBottleneck: z.string().optional(),
  activeCampaignName: z.string().optional(),
  activeCampaignAudience: z.string().optional(),
  activeCampaignChannel: z.string().optional(),
  activeCampaignOffer: z.string().optional(),
  keyMetric: z.string().optional(),
  keyMetricTarget: z.string().optional(),
  notes: z.string().optional(),
});

export type StrategyExtract = z.infer<typeof StrategyExtractSchema>;

export async function extractForStrategy(title: string, content: string): Promise<StrategyExtract> {
  const { content: raw } = await chat(
    [
      {
        role: "system",
        content: `You extract weekly strategy inputs from research briefs. Map findings to the most specific field possible. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Extract strategy-relevant fields from this research brief.

Title: ${title}
Brief:
${content.slice(0, 3000)}

Return JSON with ONLY the fields that apply (omit fields that don't):
{
  "operatorImprovementFocus": "system/leverage improvement for this week",
  "biggestBottleneck": "constraint or bottleneck identified",
  "activeCampaignName": "campaign name if research suggests one",
  "activeCampaignAudience": "target audience identified",
  "activeCampaignChannel": "distribution channel recommended",
  "activeCampaignOffer": "offer angle from research",
  "keyMetric": "metric to watch",
  "keyMetricTarget": "target value for that metric",
  "notes": "ONLY context that doesn't fit any field above"
}

Rules:
- Use the specific fields first. Only use "notes" as a last resort for truly unstructured context.
- Keep each field concise (1-2 sentences max).
- If the research doesn't inform a field, omit it entirely from the JSON.
- Return ONLY valid JSON.`,
      },
    ],
    EXTRACT_OPTS,
  );

  return StrategyExtractSchema.parse(safeParseJSON(raw));
}

// ── Lead ──

const LeadExtractSchema = z.object({
  title: z.string(),
  description: z.string(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  platform: z.string().optional(),
  techStack: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  sourceDetail: z.string().optional(),
});

export type LeadExtract = z.infer<typeof LeadExtractSchema>;

export async function extractForLead(title: string, content: string): Promise<LeadExtract> {
  const { content: raw } = await chat(
    [
      {
        role: "system",
        content: `You extract lead/opportunity information from research briefs. Return ONLY valid JSON.`,
      },
      {
        role: "user",
        content: `Extract lead information from this research brief.

Title: ${title}
Brief:
${content.slice(0, 3000)}

Return JSON:
{
  "title": "company or opportunity name — descriptive and searchable",
  "description": "full opportunity context (2-4 sentences from the research)",
  "budget": "budget range if mentioned (e.g. '$5k-$20k')",
  "timeline": "timeline if mentioned (e.g. '2-4 weeks')",
  "platform": "web|mobile|both",
  "techStack": ["technologies mentioned"],
  "tags": ["industry", "domain", "opportunity-type tags for filtering"],
  "sourceDetail": "how/where this opportunity was found"
}

Rules:
- title should be specific enough to be searchable in a leads table
- tags are rendered as badges — use 2-5 short tags (e.g. "saas", "ai", "healthcare", "b2b")
- Omit budget/timeline/platform if not mentioned in the research
- Return ONLY valid JSON.`,
      },
    ],
    EXTRACT_OPTS,
  );

  return LeadExtractSchema.parse(safeParseJSON(raw));
}
