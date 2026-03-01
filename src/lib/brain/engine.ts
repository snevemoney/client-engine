/**
 * AI Brain engine — non-streaming orchestration loop.
 * Calls Claude with tools, executes tool calls, loops until Claude gives a text-only response.
 */
import {
  createBrainMessage,
  type BrainMessage,
  type BrainToolUseBlock,
} from "@/lib/llm/anthropic";
import { BRAIN_TOOLS } from "./tools";
import { executeTool, type ToolContext } from "./executor";
import { buildSystemPrompt } from "./system-prompt";

const MAX_ITERATIONS = 10;

export type BrainResult = {
  response: string;
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    result: unknown;
    error?: string;
  }>;
  usage: { inputTokens: number; outputTokens: number };
};

export async function runBrain(params: {
  userMessage: string;
  conversationHistory: BrainMessage[];
  toolContext: ToolContext;
}): Promise<BrainResult> {
  const system = buildSystemPrompt();
  const messages: BrainMessage[] = [
    ...params.conversationHistory,
    { role: "user", content: params.userMessage },
  ];

  const allToolCalls: BrainResult["toolCalls"] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await createBrainMessage({
      system,
      messages,
      tools: BRAIN_TOOLS,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Check if response has tool_use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is BrainToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls — extract final text
      const textContent = response.content
        .filter((block) => block.type === "text")
        .map((block) => ("text" in block ? block.text : ""))
        .join("");

      return {
        response: textContent,
        toolCalls: allToolCalls,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
    }

    // Append assistant message with tool_use blocks
    messages.push({ role: "assistant", content: response.content });

    // Execute each tool and collect results
    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const toolBlock of toolUseBlocks) {
      const input = (toolBlock.input as Record<string, unknown>) || {};
      const toolResult = await executeTool(
        toolBlock.name,
        input,
        params.toolContext
      );

      allToolCalls.push({
        name: toolBlock.name,
        input,
        result: toolResult.result,
        error: toolResult.error,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: JSON.stringify(
          toolResult.error
            ? { error: toolResult.error, data: toolResult.result }
            : toolResult.result
        ),
        is_error: !!toolResult.error,
      });
    }

    // Append tool results as user message
    messages.push({ role: "user", content: toolResults });
  }

  // If we hit max iterations, return whatever we have
  return {
    response:
      "I hit my tool call limit for this turn. Here's what I gathered — ask me to continue if you need more.",
    toolCalls: allToolCalls,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
  };
}
