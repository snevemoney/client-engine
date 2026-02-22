/**
 * Operator Copilot action registry: whitelist of actions the chat can suggest and execute.
 * Only actions listed here can be run via POST /api/ops/chat/execute.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { runPipelineIfEligible } from "@/lib/pipeline/runPipeline";

const RETRY_CAP = 5;

// --- Payload schemas per action (empty object = no payload) ---

const retryFailedPipelineRunsPayload = z.object({});

export type RetryFailedPipelineRunsPayload = z.infer<typeof retryFailedPipelineRunsPayload>;

// --- Handler result type ---

export type ActionResult = {
  ok: boolean;
  resultSummary: string;
  error?: string;
};

// --- Handlers ---

async function handleRetryFailedPipelineRuns(
  _payload: RetryFailedPipelineRunsPayload
): Promise<ActionResult> {
  const failedRetryable = await db.pipelineRun.findMany({
    where: {
      success: false,
      lastErrorCode: { in: ["OPENAI_429", "OPENAI_5XX", "OPENAI_NETWORK"] },
      retryCount: { lt: 3 },
    },
    orderBy: { lastErrorAt: "desc" },
    take: RETRY_CAP * 2,
    select: { leadId: true },
  });
  const leadIdsToRetry = [...new Set(failedRetryable.map((r) => r.leadId))].slice(0, RETRY_CAP);

  let retried = 0;
  const errors: string[] = [];

  for (const leadId of leadIdsToRetry) {
    try {
      const result = await runPipelineIfEligible(leadId, "chat_retry");
      if (result.run) retried++;
    } catch (err) {
      errors.push(`${leadId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = leadIdsToRetry.length;
  const resultSummary =
    total === 0
      ? "No retryable failed runs found."
      : `Retried ${retried}/${total} lead(s).${errors.length ? ` Errors: ${errors.join("; ")}` : ""}`;

  return {
    ok: errors.length === 0,
    resultSummary,
    ...(errors.length ? { error: errors.join("; ") } : {}),
  };
}

// --- Registry: action name -> { payloadSchema, handler } ---

export const ACTION_REGISTRY = {
  retry_failed_pipeline_runs: {
    payloadSchema: retryFailedPipelineRunsPayload,
    handler: handleRetryFailedPipelineRuns,
    requiresApproval: true,
  },
} as const;

export type ActionName = keyof typeof ACTION_REGISTRY;

export function isRegisteredAction(name: string): name is ActionName {
  return name in ACTION_REGISTRY;
}

export function getRegisteredActions(): ActionName[] {
  return Object.keys(ACTION_REGISTRY) as ActionName[];
}
