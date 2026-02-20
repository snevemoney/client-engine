const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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

export async function chat(
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
