/**
 * Classify pipeline step errors for step notes and operational logging.
 * Keeps RUN_REPORT and metrics interpretable (retryable vs hard fail).
 */
export type PipelineErrorCode =
  | "OPENAI_429"
  | "OPENAI_5XX"
  | "OPENAI_4XX"
  | "OPENAI_NETWORK"
  | "VALIDATION"
  | "GATE"
  | "DB"
  | "UNKNOWN";

export function classifyPipelineError(err: unknown): { code: PipelineErrorCode; message: string } {
  const msg = err instanceof Error ? err.message : String(err ?? "unknown");
  const lower = msg.toLowerCase();

  if (lower.includes("429") || lower.includes("rate limit")) {
    return { code: "OPENAI_429", message: msg };
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("openai api error: 5")) {
    return { code: "OPENAI_5XX", message: msg };
  }
  if (lower.includes("openai api error: 4") || lower.includes("401") || lower.includes("invalid")) {
    return { code: "OPENAI_4XX", message: msg };
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("econnrefused") || lower.includes("timeout")) {
    return { code: "OPENAI_NETWORK", message: msg };
  }
  if (lower.includes("requires") || lower.includes("run ") || lower.includes("first") || lower.includes("positioning_brief")) {
    return { code: "GATE", message: msg };
  }
  if (lower.includes("json") || lower.includes("parse") || lower.includes("validation") || lower.includes("schema")) {
    return { code: "VALIDATION", message: msg };
  }
  if (lower.includes("prisma") || lower.includes("database") || lower.includes("connection")) {
    return { code: "DB", message: msg };
  }

  return { code: "UNKNOWN", message: msg };
}

/** Retryable: transient OpenAI/network; safe to retry same lead. */
const RETRYABLE_CODES: PipelineErrorCode[] = ["OPENAI_429", "OPENAI_5XX", "OPENAI_NETWORK"];

export function isRetryableError(code: PipelineErrorCode): boolean {
  return RETRYABLE_CODES.includes(code);
}

/**
 * Format step failure notes with error code for RUN_REPORT and metrics.
 */
export function formatStepFailureNotes(err: unknown): string {
  const { code, message } = classifyPipelineError(err);
  const short = message.slice(0, 200).replace(/\n/g, " ");
  return `${code}|${short}`;
}
