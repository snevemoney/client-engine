/**
 * Safe JSON parsing for LLM responses.
 * Strips markdown fences (```json ... ```) and trims before parse.
 * Prevents stuck pipelines from malformed or markdown-wrapped JSON.
 */
export function safeParseJSON<T = unknown>(raw: string): T {
  let cleaned = raw.trim();
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/gm, "").trim();
  return JSON.parse(cleaned) as T;
}
