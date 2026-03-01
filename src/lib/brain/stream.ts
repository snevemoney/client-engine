/**
 * AI Brain streaming engine.
 * Streams Claude responses with inline tool execution via SSE events.
 */
import {
  streamBrainMessage,
  type BrainMessage,
  type BrainToolUseBlock,
} from "@/lib/llm/anthropic";
import { BRAIN_TOOLS } from "./tools";
import { executeTool, type ToolContext } from "./executor";
import { buildSystemPrompt } from "./system-prompt";

const MAX_ITERATIONS = 10;

export type BrainStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; name: string; id: string }
  | { type: "tool_input"; id: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: unknown; error?: string }
  | { type: "error"; message: string }
  | { type: "done"; usage: { inputTokens: number; outputTokens: number } };

export async function* streamBrainWithTools(params: {
  userMessage: string;
  conversationHistory: BrainMessage[];
  toolContext: ToolContext;
  systemSuffix?: string;
}): AsyncGenerator<BrainStreamEvent> {
  const base = buildSystemPrompt();
  const system = params.systemSuffix ? `${base}\n\n${params.systemSuffix}` : base;
  const messages: BrainMessage[] = [
    ...params.conversationHistory,
    { role: "user", content: params.userMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const stream = streamBrainMessage({
      system,
      messages,
      tools: BRAIN_TOOLS,
    });

    // Collect the full response while streaming text deltas
    const contentBlocks: Array<{ type: string; [key: string]: unknown }> = [];
    let currentToolUse: {
      id: string;
      name: string;
      inputJson: string;
    } | null = null;

    try {
      for await (const event of stream) {
        if (event.type === "content_block_start") {
          const block = event.content_block;
          if (block.type === "text") {
            contentBlocks.push({ type: "text", text: "" });
          } else if (block.type === "tool_use") {
            currentToolUse = { id: block.id, name: block.name, inputJson: "" };
            contentBlocks.push({
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: {},
            });
            yield { type: "tool_start", name: block.name, id: block.id };
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            const lastText = contentBlocks[contentBlocks.length - 1];
            if (lastText && lastText.type === "text") {
              (lastText as unknown as { text: string }).text += event.delta.text;
            }
            yield { type: "text_delta", text: event.delta.text };
          } else if (
            event.delta.type === "input_json_delta" &&
            currentToolUse
          ) {
            currentToolUse.inputJson += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop") {
          if (currentToolUse) {
            let parsedInput: Record<string, unknown> = {};
            try {
              parsedInput = currentToolUse.inputJson
                ? JSON.parse(currentToolUse.inputJson)
                : {};
            } catch {
              // If JSON parse fails, use empty object
            }
            // Update the content block with parsed input
            const toolBlock = contentBlocks.find(
              (b) =>
                b.type === "tool_use" && b.id === currentToolUse!.id
            );
            if (toolBlock) {
              toolBlock.input = parsedInput;
            }
            yield {
              type: "tool_input",
              id: currentToolUse.id,
              input: parsedInput,
            };
            currentToolUse = null;
          }
        } else if (event.type === "message_delta") {
          // Track usage from message_delta
          if (event.usage) {
            totalOutputTokens += event.usage.output_tokens ?? 0;
          }
        }
      }
    } catch (e) {
      yield {
        type: "error",
        message: e instanceof Error ? e.message : "Stream error",
      };
      break;
    }

    // Get final message for usage
    const finalMessage = await stream.finalMessage();
    totalInputTokens += finalMessage.usage.input_tokens;
    // output_tokens already tracked via message_delta, but ensure we have it
    totalOutputTokens = Math.max(
      totalOutputTokens,
      finalMessage.usage.output_tokens
    );

    // Check for tool_use blocks
    const toolUseBlocks = contentBlocks.filter(
      (b) => b.type === "tool_use"
    ) as unknown as BrainToolUseBlock[];

    if (toolUseBlocks.length === 0) {
      // No tool calls — we're done
      yield {
        type: "done",
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      };
      return;
    }

    // Append assistant message with all content blocks
    messages.push({
      role: "assistant",
      content: finalMessage.content,
    });

    // Execute tools and append results
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

      yield {
        type: "tool_result",
        id: toolBlock.id,
        name: toolBlock.name,
        result: toolResult.result,
        error: toolResult.error,
      };

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

  // Max iterations reached
  yield {
    type: "done",
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
  };
}
