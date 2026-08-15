const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_BASE = "https://api.openai.com/v1";
const LLM_TIMEOUT_MS = 90_000;

/** Hive standard — see n8n-cursor docs/hive/LLM_MODEL_STANDARD.md */
const ANTHROPIC_DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";
const OPENAI_FAST_MODEL = process.env.OPENAI_FALLBACK_MODEL ?? "gpt-4o-mini";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
};

export type ChatResult = {
  content: string;
  usage?: ChatUsage;
};

async function chatWithAnthropic(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<ChatResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: LLM_TIMEOUT_MS });

  const systemParts: string[] = [];
  const chatMessages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      chatMessages.push({ role: m.role as "user" | "assistant", content: m.content });
    }
  }
  const system = systemParts.join("\n\n") || undefined;

  const resp = await client.messages.create({
    model: opts?.model ?? ANTHROPIC_DEFAULT_MODEL,
    max_tokens: opts?.max_tokens ?? 2048,
    temperature: opts?.temperature ?? 0.7,
    system: system ?? undefined,
    messages: chatMessages.length ? chatMessages : [{ role: "user", content: "Continue." }],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  const content = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const usage = resp.usage
    ? {
        prompt_tokens: resp.usage.input_tokens,
        completion_tokens: resp.usage.output_tokens,
        total_tokens: resp.usage.input_tokens + resp.usage.output_tokens,
      }
    : undefined;

  return { content, usage };
}

async function chatWithOpenAI(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<ChatResult> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: opts?.model || OPENAI_FAST_MODEL,
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.max_tokens ?? 2048,
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const content = data.choices[0].message?.content ?? "";
  const usage = data.usage
    ? {
        prompt_tokens: data.usage.prompt_tokens ?? 0,
        completion_tokens: data.usage.completion_tokens ?? 0,
        total_tokens: data.usage.total_tokens,
      }
    : undefined;

  return { content, usage };
}

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.includes("rate limit")) return true;
  if (msg.includes("500") || msg.includes("502") || msg.includes("503")) return true;
  if (msg.includes("ETIMEDOUT") || msg.includes("timeout") || msg.includes("aborted")) return true;
  if (msg.includes("ECONNRESET") || msg.includes("ENOTFOUND") || msg.includes("network")) return true;
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const MAX_RETRIES = 3;

function mapOpenAIFallbackModel(requested?: string): string {
  if (!requested) return OPENAI_DEFAULT_MODEL;
  if (requested.startsWith("claude-")) return OPENAI_DEFAULT_MODEL;
  return requested;
}

export async function chat(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<ChatResult> {
  const preferAnthropic = Boolean(ANTHROPIC_API_KEY);
  const openaiOpts = {
    ...opts,
    model: mapOpenAIFallbackModel(opts?.model),
  };

  if (preferAnthropic) {
    try {
      return await chatWithAnthropic(messages, opts);
    } catch (anthropicErr) {
      if (!OPENAI_API_KEY) {
        const msg =
          anthropicErr instanceof Error ? anthropicErr.message : String(anthropicErr);
        throw new Error(`Anthropic API error: ${msg}`);
      }
      if (!isRetryableError(anthropicErr)) {
        console.warn("[llm] Anthropic failed, falling back to OpenAI:", anthropicErr);
      }
      try {
        return await chatWithOpenAI(messages, openaiOpts);
      } catch (openaiErr) {
        const aMsg =
          anthropicErr instanceof Error ? anthropicErr.message : String(anthropicErr);
        const oMsg = openaiErr instanceof Error ? openaiErr.message : String(openaiErr);
        throw new Error(`Anthropic failed (${aMsg}); OpenAI fallback failed (${oMsg})`);
      }
    }
  }

  if (!OPENAI_API_KEY) {
    throw new Error("Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set");
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await chatWithOpenAI(messages, openaiOpts);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isRetryableError(err)) {
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
        await sleep(backoffMs);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`OpenAI API error: ${msg}`);
      }
    }
  }
  throw lastErr;
}
