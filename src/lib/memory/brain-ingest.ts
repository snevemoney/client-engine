/**
 * Memory ingestion from AI Brain conversations.
 * Creates OperatorMemoryEvents for write-tool executions so the
 * learned-weight pipeline can personalize future NBA ranking.
 */
import { db } from "@/lib/db";
import { OperatorMemorySourceType, OperatorMemoryOutcome } from "@prisma/client";
import { logOpsEventSafe } from "@/lib/ops-events/log";

type BrainToolCall = {
  name: string;
  input: unknown;
  result: unknown;
};

export async function ingestFromBrainConversation(params: {
  sessionId: string;
  userId: string;
  toolCalls: BrainToolCall[];
  userMessage: string;
}): Promise<void> {
  const { sessionId, userId, toolCalls, userMessage } = params;

  for (const tc of toolCalls) {
    try {
      const outcome = tc.result ? OperatorMemoryOutcome.success : OperatorMemoryOutcome.failure;
      const actionKey = tc.name;
      const meta = tc.input as Record<string, unknown> | null;
      const ruleKey = (meta?.ruleKey as string) ?? (meta?.templateKey as string) ?? null;

      await db.operatorMemoryEvent.create({
        data: {
          actorUserId: userId,
          sourceType: OperatorMemorySourceType.copilot_action,
          entityType: (meta?.entityType as string) ?? null,
          entityId: (meta?.entityId as string) ?? null,
          ruleKey,
          actionKey,
          outcome,
          metaJson: {
            source: "brain",
            sessionId,
            toolName: tc.name,
            userMessage: userMessage.slice(0, 200),
          },
        },
      });
    } catch (err) {
      logOpsEventSafe({
        category: "system",
        eventKey: "memory.brain_ingest.failed",
        status: "failure",
        errorMessage: err instanceof Error ? err.message : "brain ingest error",
        meta: { sessionId, toolName: tc.name },
      });
    }
  }
}
