/**
 * AI Brain tool definitions.
 * Each tool maps to existing internal functions — no bypassing.
 */
import type { BrainToolDefinition } from "@/lib/llm/anthropic";

export const BRAIN_TOOLS: BrainToolDefinition[] = [
  {
    name: "get_business_snapshot",
    description:
      "Get the current operator score (health band), open risk flags by severity, and queued next best actions. Call this first before giving any business advice.",
    input_schema: {
      type: "object" as const,
      properties: {
        entityType: {
          type: "string",
          description: "Entity scope. Defaults to command_center.",
          default: "command_center",
        },
        entityId: {
          type: "string",
          description: "Entity ID. Defaults to command_center.",
          default: "command_center",
        },
      },
      required: [],
    },
  },
  {
    name: "get_executive_brief",
    description:
      "Get the executive brief: money scorecard, stage conversion, pipeline leak, revenue forecast, primary constraint, constraint playbook, biggest risk, best lead, and top 3 actions for tomorrow.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_pipeline",
    description:
      "Get current pipeline: qualified leads, ready proposals, next actions, risk flags, and recent wins.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_growth_summary",
    description:
      "Get growth pipeline summary: deals by stage, overdue follow-ups, upcoming follow-ups, last activity timestamp. Requires the user ID.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "search_knowledge",
    description:
      "Search the knowledge base (including YouTube transcript insights, learning proposals, and artifacts) using semantic search. Use this to find relevant content, lessons learned, or patterns.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query.",
        },
        topK: {
          type: "number",
          description: "Number of results to return. Defaults to 5.",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_memory_patterns",
    description:
      "Get the operator's learned preferences and patterns: top rule weights (what they value), trend diffs (what's changing week over week), and policy suggestions (rules to suppress or escalate).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "run_risk_rules",
    description:
      "Evaluate all risk rules and upsert risk flags. Use this when the operator asks to check for risks or when risk data seems stale.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "run_next_actions",
    description:
      "Regenerate next best actions from rules. Use when actions seem stale or the operator asks for fresh recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {
        entityType: {
          type: "string",
          description:
            "Scope: command_center, review_stream, or founder_growth. Defaults to command_center.",
          default: "command_center",
        },
        entityId: {
          type: "string",
          description: "Entity ID. Defaults to command_center.",
          default: "command_center",
        },
      },
      required: [],
    },
  },
  {
    name: "recompute_score",
    description:
      "Refresh the operator score snapshot. Use when score seems stale or after running risk rules / next actions.",
    input_schema: {
      type: "object" as const,
      properties: {
        entityType: {
          type: "string",
          description: "command_center or review_stream. Defaults to command_center.",
          default: "command_center",
        },
        entityId: {
          type: "string",
          description: "Entity ID. Defaults to command_center.",
          default: "command_center",
        },
      },
      required: [],
    },
  },
  {
    name: "execute_nba",
    description:
      "Execute a specific next best action by its ID. Available action keys: mark_done, snooze_1d, dismiss, don_t_suggest_again_30d, recompute_score, run_risk_rules, run_next_actions, retry_failed_deliveries, growth_open_deal, growth_schedule_followup_3d, growth_mark_replied.",
    input_schema: {
      type: "object" as const,
      properties: {
        nextActionId: {
          type: "string",
          description: "The ID of the next best action to execute.",
        },
        actionKey: {
          type: "string",
          description: "The action to perform on the NBA.",
        },
      },
      required: ["nextActionId", "actionKey"],
    },
  },
  {
    name: "draft_outreach",
    description:
      "Draft an outreach message using a template. Returns the rendered message text.",
    input_schema: {
      type: "object" as const,
      properties: {
        templateKey: {
          type: "string",
          description:
            "Template key: cold_dm, follow_up, referral_ask, or value_add.",
        },
        variables: {
          type: "object",
          description:
            "Template variables: name, handle, niche, followers, project, result, etc.",
        },
      },
      required: ["templateKey", "variables"],
    },
  },
  {
    name: "get_ops_health",
    description:
      "Get system health: failed jobs (24h/7d), pipeline run status, stale entities, and overall system status.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

/** Human-readable display names for tools shown in the chat UI. */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  get_business_snapshot: "Reading business health",
  get_executive_brief: "Pulling executive brief",
  get_pipeline: "Checking pipeline",
  get_growth_summary: "Reviewing growth pipeline",
  search_knowledge: "Searching knowledge base",
  get_memory_patterns: "Analyzing your patterns",
  run_risk_rules: "Running risk rules",
  run_next_actions: "Generating next actions",
  recompute_score: "Recomputing score",
  execute_nba: "Executing action",
  draft_outreach: "Drafting outreach",
  get_ops_health: "Checking system health",
};

/** Tools that modify state and should be confirmed before execution. */
export const WRITE_TOOLS = new Set([
  "run_risk_rules",
  "run_next_actions",
  "recompute_score",
  "execute_nba",
  "draft_outreach",
]);
