/**
 * Normalize LLM provider usage into a consistent shape for pipeline step logging.
 * Keeps metrics comparable across enrich/score/position/propose/build.
 */

export type UsageShape = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type NormalizedUsage = {
  tokensUsed: number;
  costEstimate: number;
};

/**
 * Rough OpenAI list pricing (per 1M tokens) for common models. Update as needed.
 */
const COST_PER_1M = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4-turbo": { input: 10, output: 30 },
} as const;

export function normalizeUsage(
  usage: UsageShape | null | undefined,
  model: string = "gpt-4o-mini"
): NormalizedUsage {
  if (!usage) {
    return { tokensUsed: 0, costEstimate: 0 };
  }

  const prompt = usage.prompt_tokens ?? 0;
  const completion = usage.completion_tokens ?? 0;
  const total = usage.total_tokens ?? prompt + completion;
  const tokensUsed = total > 0 ? total : prompt + completion;

  const costs = COST_PER_1M[model as keyof typeof COST_PER_1M] ?? COST_PER_1M["gpt-4o-mini"];
  const costEstimate =
    (prompt / 1_000_000) * costs.input +
    (completion / 1_000_000) * costs.output;

  return { tokensUsed, costEstimate };
}
