/**
 * Multi-Agent Business Automation — type definitions.
 */

export type AgentId =
  | "revenue"
  | "delivery"
  | "growth"
  | "retention"
  | "intelligence"
  | "system";

export type ScheduledRun = {
  cronLabel: string; // "daily_morning" | "weekly_monday" | "every_6h"
  taskPrompt: string;
};

export type AgentConfig = {
  id: AgentId;
  name: string;
  description: string;
  systemPromptExtension: string;
  allowedTools: string[];
  scheduledRuns: ScheduledRun[];
  /** Tools this agent can auto-execute without approval */
  autoApprovedTools: string[];
};

export type ToolCallRecord = {
  name: string;
  input: Record<string, unknown>;
  result: unknown;
  error?: string;
  approvalRequired?: boolean;
};

export type AgentRunResult = {
  agentRunId: string;
  status: "completed" | "failed" | "awaiting_approval";
  resultSummary: string;
  toolCalls: ToolCallRecord[];
  pendingApprovals: Array<{
    id: string;
    toolName: string;
    reason: string;
  }>;
  usage: { inputTokens: number; outputTokens: number };
};

/** Budget limits to prevent runaway agent costs */
export const AGENT_LIMITS = {
  maxTokensPerRun: 50_000,
  maxToolCallsPerRun: 15,
  maxConcurrentRuns: 2,
  approvalExpiryHours: 24,
  staleRunTimeoutMinutes: 15,
} as const;
