const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_BASE = "https://api.openai.com/v1";

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

/** Use Anthropic when ANTHROPIC_API_KEY is set; otherwise OpenAI. */
function getProvider(): "anthropic" | "openai" {
  if (ANTHROPIC_API_KEY) return "anthropic";
  if (OPENAI_API_KEY) return "openai";
  throw new Error("Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set");
}

async function chatWithAnthropic(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<ChatResult> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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
    model: opts?.model ?? "claude-3-5-haiku-20241022",
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
      model: opts?.model || "gpt-4o-mini",
      messages,
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.max_tokens ?? 2048,
    }),
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

export async function chat(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
): Promise<ChatResult> {
  const provider = getProvider();
  if (provider === "anthropic") {
    try {
      return await chatWithAnthropic(messages, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Anthropic API error: ${msg}`);
    }
  }
  return chatWithOpenAI(messages, opts);
}
