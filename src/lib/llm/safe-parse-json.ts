import { z } from "zod";

/**
 * Safe JSON parsing for LLM responses.
 * Strips markdown fences (```json ... ```) and trims before parse.
 * Prevents stuck pipelines from malformed or markdown-wrapped JSON.
 * Optional Zod schema validates shape after parse.
 */
export function safeParseJSON<T = unknown>(raw: string, schema?: z.ZodType<T>): T {
  let cleaned = raw.trim();
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/gm, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        const msg = result.error.issues.map((i) => i.message).join("; ");
        throw new Error(`JSON validation failed: ${msg}`);
      }
      return result.data;
    }
    return parsed as T;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
    throw e;
  }
}
