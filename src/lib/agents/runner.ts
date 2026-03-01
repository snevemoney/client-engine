/**
 * Multi-Agent Business Automation — agent runner.
 * Runs a domain agent: specialized prompt + tool subset + approval gates.
 * Follows the same Claude tool-calling loop as src/lib/brain/engine.ts.
 */
import {
  createBrainMessage,
  type BrainMessage,
  type BrainToolUseBlock,
} from "@/lib/llm/anthropic";
import { BRAIN_TOOLS } from "@/lib/brain/tools";
import { executeTool, type ToolContext } from "@/lib/brain/executor";
import { buildSystemPrompt } from "@/lib/brain/system-prompt";
import { db } from "@/lib/db";
import { getAgentConfig } from "./registry";
import { requiresApproval, createApprovalRequest } from "./approval";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta } from "@/lib/ops-events/sanitize";
import type { AgentId, AgentRunResult, ToolCallRecord } from "./types";
import { AGENT_LIMITS } from "./types";

const MAX_ITERATIONS = 10;
const CONSECUTIVE_FAIL_LIMIT = 2;

export async function runAgent(
  agentId: AgentId,
  taskPrompt: string,
  toolContext: ToolContext,
  options?: {
    triggerType?: "brain_delegation" | "scheduled" | "event";
    triggerSource?: string;
    dedupeKey?: string;
  }
): Promise<AgentRunResult> {
  const config = getAgentConfig(agentId);
  if (!config) {
    return {
      agentRunId: "",
      status: "failed",
      resultSummary: `Unknown agent: ${agentId}`,
      toolCalls: [],
      pendingApprovals: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  // Check concurrency limit
  const runningCount = await db.agentRun.count({ where: { status: "running" } });
  if (runningCount >= AGENT_LIMITS.maxConcurrentRuns) {
    return {
      agentRunId: "",
      status: "failed",
      resultSummary: `Concurrency limit reached (${AGENT_LIMITS.maxConcurrentRuns} agents running). Try again later.`,
      toolCalls: [],
      pendingApprovals: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  // Check deduplication
  if (options?.dedupeKey) {
    const existing = await db.agentRun.findUnique({
      where: { dedupeKey: options.dedupeKey },
    });
    if (existing) {
      return {
        agentRunId: existing.id,
        status: existing.status as AgentRunResult["status"],
        resultSummary: existing.resultSummary ?? "Already ran (deduplicated)",
        toolCalls: (existing.toolCallsJson as ToolCallRecord[]) ?? [],
        pendingApprovals: [],
        usage: (existing.tokenUsage as { inputTokens: number; outputTokens: number }) ?? { inputTokens: 0, outputTokens: 0 },
      };
    }
  }

  // Create agent run record
  const agentRun = await db.agentRun.create({
    data: {
      agentId,
      triggerType: options?.triggerType ?? "brain_delegation",
      triggerSource: options?.triggerSource ?? null,
      taskPrompt,
      status: "running",
      dedupeKey: options?.dedupeKey ?? null,
    },
  });

  logOpsEventSafe({
    category: "system",
    eventKey: "agent.run.started",
    meta: sanitizeMeta({
      agentRunId: agentRun.id,
      agentId,
      triggerType: options?.triggerType,
    }),
  });

  // Build agent-specific system prompt
  const basePrompt = buildSystemPrompt();
  const system = `${basePrompt}\n\n${config.systemPromptExtension}`;

  // Filter tools to agent's allowlist
  const agentTools = BRAIN_TOOLS.filter((t) =>
    config.allowedTools.includes(t.name)
  );

  const messages: BrainMessage[] = [
    { role: "user", content: taskPrompt },
  ];

  const allToolCalls: ToolCallRecord[] = [];
  const pendingApprovals: AgentRunResult["pendingApprovals"] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let consecutiveFailures = 0;
  let finalText = "";

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // Token budget check
      if (totalInputTokens + totalOutputTokens > AGENT_LIMITS.maxTokensPerRun) {
        finalText = "Token budget exceeded. Stopping agent run.";
        break;
      }

      // Tool call limit check
      if (allToolCalls.length >= AGENT_LIMITS.maxToolCallsPerRun) {
        finalText = "Tool call limit reached. Stopping agent run.";
        break;
      }

      const response = await createBrainMessage({
        system,
        messages,
        tools: agentTools,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const toolUseBlocks = response.content.filter(
        (block): block is BrainToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        finalText = response.content
          .filter((block) => block.type === "text")
          .map((block) => ("text" in block ? block.text : ""))
          .join("");
        break;
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error?: boolean;
      }> = [];

      for (const toolBlock of toolUseBlocks) {
        const input = (toolBlock.input as Record<string, unknown>) || {};

        // Check approval gate
        if (requiresApproval(config, toolBlock.name)) {
          const approvalId = await createApprovalRequest({
            agentRunId: agentRun.id,
            toolName: toolBlock.name,
            toolInput: input,
            reason: `${config.name} wants to execute ${toolBlock.name} with: ${JSON.stringify(input).slice(0, 200)}`,
          });

          allToolCalls.push({
            name: toolBlock.name,
            input,
            result: null,
            approvalRequired: true,
          });

          pendingApprovals.push({
            id: approvalId,
            toolName: toolBlock.name,
            reason: `Needs approval: ${toolBlock.name}`,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: JSON.stringify({
              status: "awaiting_approval",
              message: "This action requires operator approval. The operator has been notified.",
            }),
            is_error: false,
          });
          continue;
        }

        // Execute auto-approved tool
        const toolResult = await executeTool(toolBlock.name, input, toolContext);

        if (toolResult.error) {
          consecutiveFailures++;
        } else {
          consecutiveFailures = 0;
        }

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

        // Circuit breaker: abort after consecutive failures
        if (consecutiveFailures >= CONSECUTIVE_FAIL_LIMIT) {
          finalText = `Agent stopped: ${CONSECUTIVE_FAIL_LIMIT} consecutive tool failures. Last error: ${toolResult.error}`;
          break;
        }
      }

      if (consecutiveFailures >= CONSECUTIVE_FAIL_LIMIT) break;

      // If we created approval requests, stop the loop
      if (pendingApprovals.length > 0) {
        finalText =
          "Agent paused — waiting for operator approval on one or more actions.";
        break;
      }

      messages.push({ role: "user", content: toolResults });
    }
  } catch (e) {
    finalText = `Agent error: ${e instanceof Error ? e.message : "Unknown error"}`;
  }

  // Determine final status
  const status: AgentRunResult["status"] =
    pendingApprovals.length > 0
      ? "awaiting_approval"
      : consecutiveFailures >= CONSECUTIVE_FAIL_LIMIT
        ? "failed"
        : "completed";

  // Update agent run record
  await db.agentRun.update({
    where: { id: agentRun.id },
    data: {
      status,
      resultSummary: finalText.slice(0, 5000),
      toolCallsJson: allToolCalls,
      tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      finishedAt: status !== "awaiting_approval" ? new Date() : null,
    },
  });

  logOpsEventSafe({
    category: "system",
    eventKey: `agent.run.${status}`,
    meta: sanitizeMeta({
      agentRunId: agentRun.id,
      agentId,
      toolCallCount: allToolCalls.length,
      tokenUsage: totalInputTokens + totalOutputTokens,
      pendingApprovals: pendingApprovals.length,
    }),
  });

  // Ingest into memory (non-blocking)
  if (status === "completed" && allToolCalls.length > 0) {
    try {
      const { ingestFromAgentRun } = await import("@/lib/memory/agent-ingest");
      ingestFromAgentRun(agentRun.id, toolContext.userId).catch((err) =>
        console.error("[agent-memory-ingest]", err)
      );
    } catch {
      // Module might not exist yet during phased rollout
    }
  }

  return {
    agentRunId: agentRun.id,
    status,
    resultSummary: finalText,
    toolCalls: allToolCalls,
    pendingApprovals,
    usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  };
}
