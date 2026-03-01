/**
 * Agent memory ingestion — feeds agent run outcomes into the learning pipeline.
 * Reuses the same weight-updating pattern from src/lib/memory/ingest.ts.
 */
import { db } from "@/lib/db";
import { OperatorMemorySourceType, OperatorMemoryOutcome } from "@prisma/client";
import { logOpsEventSafe } from "@/lib/ops-events/log";
import { sanitizeMeta, sanitizeErrorMessage } from "@/lib/ops-events/sanitize";

const WEIGHT_CLAMP = { min: -10, max: 10 };

function clamp(weight: number): number {
  return Math.max(WEIGHT_CLAMP.min, Math.min(WEIGHT_CLAMP.max, weight));
}

async function upsertWeight(
  actorUserId: string,
  kind: "rule" | "action",
  key: string,
  delta: number
): Promise<void> {
  const existing = await db.operatorLearnedWeight.findUnique({
    where: { actorUserId_kind_key: { actorUserId, kind, key } },
  });

  const now = new Date();
  const newWeight = clamp((existing?.weight ?? 0) + delta);
  const prev = (existing?.statsJson as Record<string, unknown>) ?? {};
  const statsJson = {
    total: ((prev.total as number) ?? 0) + 1,
    successCount: ((prev.successCount as number) ?? 0) + (delta > 0 ? 1 : 0),
    lastSeenAt: now.toISOString(),
  };

  if (existing) {
    await db.operatorLearnedWeight.update({
      where: { id: existing.id },
      data: { weight: newWeight, statsJson, updatedAt: now },
    });
  } else {
    await db.operatorLearnedWeight.create({
      data: { actorUserId, kind, key, weight: newWeight, statsJson, updatedAt: now },
    });
  }
}

/**
 * Ingest outcomes from a completed agent run into the memory pipeline.
 * Creates OperatorMemoryEvent records and updates learned weights.
 */
export async function ingestFromAgentRun(
  agentRunId: string,
  actorUserId: string
): Promise<void> {
  try {
    const run = await db.agentRun.findUnique({ where: { id: agentRunId } });
    if (!run || run.status !== "completed") return;

    const toolCalls = (run.toolCallsJson as Array<{
      name: string;
      input: Record<string, unknown>;
      result: unknown;
      error?: string;
      approvalRequired?: boolean;
    }>) ?? [];

    // Only process write-tool calls that actually executed
    const executedWriteTools = toolCalls.filter(
      (tc) => !tc.approvalRequired && !tc.name.startsWith("get_") && !tc.name.startsWith("list_") && tc.name !== "search_knowledge"
    );

    if (executedWriteTools.length === 0) return;

    // Create a single memory event for the agent run
    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.agent_run,
        entityType: "agent",
        entityId: run.agentId,
        ruleKey: `agent.${run.agentId}`,
        actionKey: null,
        outcome: OperatorMemoryOutcome.success,
        metaJson: {
          agentRunId,
          agentId: run.agentId,
          triggerType: run.triggerType,
          toolCallCount: executedWriteTools.length,
          toolNames: executedWriteTools.map((tc) => tc.name),
        },
      },
    });

    // Update weights for the agent itself
    await upsertWeight(actorUserId, "rule", `agent.${run.agentId}`, 0.5);

    // Update weights for each action the agent took
    for (const tc of executedWriteTools) {
      const delta = tc.error ? -0.5 : 0.5;
      await upsertWeight(actorUserId, "action", tc.name, delta);
    }

    logOpsEventSafe({
      category: "system",
      eventKey: "memory.agent_run_ingested",
      meta: sanitizeMeta({
        agentRunId,
        agentId: run.agentId,
        writeToolCount: executedWriteTools.length,
      }),
    });
  } catch (err) {
    console.error("[agent-memory-ingest]", err);
    logOpsEventSafe({
      category: "system",
      eventKey: "memory.agent_ingest.failed",
      status: "failure",
      errorMessage: sanitizeErrorMessage(err),
      meta: sanitizeMeta({ agentRunId }),
    });
  }
}

/**
 * Ingest a rejection event — operator rejected an agent's proposed tool call.
 * Creates a negative memory signal so the system down-ranks similar actions.
 */
export async function ingestFromAgentRejection(
  agentRunId: string,
  toolName: string,
  actorUserId: string
): Promise<void> {
  try {
    const run = await db.agentRun.findUnique({ where: { id: agentRunId } });
    if (!run) return;

    await db.operatorMemoryEvent.create({
      data: {
        actorUserId,
        sourceType: OperatorMemorySourceType.agent_run,
        entityType: "agent",
        entityId: run.agentId,
        ruleKey: `agent.${run.agentId}`,
        actionKey: toolName,
        outcome: OperatorMemoryOutcome.failure,
        metaJson: {
          agentRunId,
          agentId: run.agentId,
          rejectedTool: toolName,
          triggerType: run.triggerType,
        },
      },
    });

    // Negative weight for the agent overall
    await upsertWeight(actorUserId, "rule", `agent.${run.agentId}`, -0.5);
    // Stronger negative weight for the specific rejected action
    await upsertWeight(actorUserId, "action", toolName, -1.0);

    logOpsEventSafe({
      category: "system",
      eventKey: "memory.agent_rejection_ingested",
      meta: sanitizeMeta({
        agentRunId,
        agentId: run.agentId,
        rejectedTool: toolName,
      }),
    });
  } catch (err) {
    console.error("[agent-memory-ingest]", err);
    logOpsEventSafe({
      category: "system",
      eventKey: "memory.agent_rejection_ingest.failed",
      status: "failure",
      errorMessage: sanitizeErrorMessage(err),
      meta: sanitizeMeta({ agentRunId, toolName }),
    });
  }
}
