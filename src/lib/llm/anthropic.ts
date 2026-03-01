/**
 * Anthropic Claude SDK wrapper for the AI Brain.
 * Provides both non-streaming and streaming message creation with tool_use support.
 */
import Anthropic from "@anthropic-ai/sdk";
import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";

const apiKey = process.env.ANTHROPIC_API_KEY;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export type BrainToolDefinition = Anthropic.Messages.Tool;
export type BrainMessage = Anthropic.Messages.MessageParam;
export type BrainContentBlock = Anthropic.Messages.ContentBlock;
export type BrainToolUseBlock = Anthropic.Messages.ToolUseBlock;
export type BrainToolResultBlock = Anthropic.Messages.ToolResultBlockParam;

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export async function createBrainMessage(params: {
  system: string;
  messages: BrainMessage[];
  tools: BrainToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}): Promise<Anthropic.Messages.Message> {
  const client = getClient();
  return client.messages.create({
    model: params.model ?? DEFAULT_MODEL,
    system: params.system,
    messages: params.messages,
    tools: params.tools,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.3,
  });
}

export function streamBrainMessage(params: {
  system: string;
  messages: BrainMessage[];
  tools: BrainToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}): MessageStream {
  const client = getClient();
  return client.messages.stream({
    model: params.model ?? DEFAULT_MODEL,
    system: params.system,
    messages: params.messages,
    tools: params.tools,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.3,
  });
}
