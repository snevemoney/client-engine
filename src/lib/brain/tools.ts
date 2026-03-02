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
            "Template key: broken_link_fix, canva_site_upgrade, google_form_upgrade, linktree_cleanup, big_audience_no_site, calendly_blank_fix, followup_leakage_audit, or proof_driven_intro.",
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

  // ─── CRUD Tools (Phase 9: Multi-Agent) ────────────────────────

  {
    name: "list_leads",
    description:
      "List leads with optional filters. Returns id, title, status, source, contactName, contactEmail, score, createdAt. Status values: NEW, ENRICHED, SCORED, APPROVED, REJECTED, BUILDING, SHIPPED.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "Filter by status (e.g. NEW, SCORED, APPROVED).",
        },
        limit: {
          type: "number",
          description: "Max results. Defaults to 20.",
          default: 20,
        },
      },
      required: [],
    },
  },
  {
    name: "update_lead",
    description:
      "Update a lead's status, notes, or score. Provide the lead ID and the fields to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        leadId: { type: "string", description: "The lead ID." },
        status: {
          type: "string",
          description: "New status: NEW, ENRICHED, SCORED, APPROVED, REJECTED, BUILDING, SHIPPED.",
        },
        description: { type: "string", description: "Updated description / notes." },
        score: { type: "number", description: "Updated score (0-100)." },
        scoreReason: { type: "string", description: "Updated score reason." },
      },
      required: ["leadId"],
    },
  },
  {
    name: "list_proposals",
    description:
      "List proposals with optional filters. Returns id, title, clientName, status, priceMin, priceMax, createdAt. Status values: draft, ready, sent, viewed, accepted, rejected, expired.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status." },
        limit: { type: "number", description: "Max results. Defaults to 20.", default: 20 },
      },
      required: [],
    },
  },
  {
    name: "update_proposal",
    description:
      "Update a proposal's status, pricing, or notes. Provide the proposal ID and fields to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        proposalId: { type: "string", description: "The proposal ID." },
        status: { type: "string", description: "New status: draft, ready, sent, viewed, accepted, rejected, expired." },
        priceMin: { type: "number", description: "Updated minimum price." },
        priceMax: { type: "number", description: "Updated maximum price." },
        summary: { type: "string", description: "Updated summary." },
      },
      required: ["proposalId"],
    },
  },
  {
    name: "list_delivery_projects",
    description:
      "List delivery projects with optional filters. Returns id, title, clientName, status, dueDate, completedAt. Status values: not_started, kickoff, in_progress, qa, blocked, completed, archived.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "Filter by status." },
        limit: { type: "number", description: "Max results. Defaults to 20.", default: 20 },
      },
      required: [],
    },
  },
  {
    name: "update_delivery_project",
    description:
      "Update a delivery project's status, notes, or dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The delivery project ID." },
        status: { type: "string", description: "New status: not_started, kickoff, in_progress, qa, blocked, completed, archived." },
        deliveryNotes: { type: "string", description: "Updated delivery notes." },
        dueDate: { type: "string", description: "Updated due date (ISO 8601)." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "manage_deal",
    description:
      "Update a growth deal's stage, priority, or schedule follow-up. Stage values: new, contacted, replied, call_scheduled, proposal_sent, won, lost.",
    input_schema: {
      type: "object" as const,
      properties: {
        dealId: { type: "string", description: "The deal ID." },
        stage: { type: "string", description: "New stage." },
        priority: { type: "string", description: "Priority: low, medium, high, critical." },
        nextFollowUpDays: { type: "number", description: "Schedule next follow-up in N days from now." },
        notes: { type: "string", description: "Notes to record as an outreach event." },
      },
      required: ["dealId"],
    },
  },
  {
    name: "send_operator_alert",
    description:
      "Send a notification alert to the operator. Use for important updates, warnings, or action items that need attention.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Alert title." },
        message: { type: "string", description: "Alert message body." },
        severity: { type: "string", description: "info, warning, or critical. Defaults to info.", default: "info" },
        actionUrl: { type: "string", description: "Optional URL to navigate to." },
      },
      required: ["title", "message"],
    },
  },

  // ─── Distribution & Signals ─────────────────────────────────

  {
    name: "list_proof_records",
    description:
      "List proof records with optional filters. Returns id, title, company, outcome, metricValue, metricLabel, createdAt, and whether content posts exist. Use to find proof for distribution or analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        hasContentPost: {
          type: "boolean",
          description: "Filter: true = only records with posts, false = only records without posts.",
        },
        limit: {
          type: "number",
          description: "Max results. Defaults to 20.",
          default: 20,
        },
      },
      required: [],
    },
  },
  {
    name: "schedule_content_post",
    description:
      "Generate and optionally schedule a content post from a proof record. Creates a draft post for the given platform. If scheduledFor is provided, also schedules it.",
    input_schema: {
      type: "object" as const,
      properties: {
        proofRecordId: {
          type: "string",
          description: "The proof record ID to create content from.",
        },
        platform: {
          type: "string",
          description: "Platform: linkedin, twitter, or email_newsletter. Defaults to linkedin.",
          default: "linkedin",
        },
        scheduledFor: {
          type: "string",
          description: "Optional ISO 8601 datetime to schedule the post.",
        },
      },
      required: ["proofRecordId"],
    },
  },
  {
    name: "list_signals",
    description:
      "List signal items with optional filters. Returns id, title, score, tags, sourceUrl, status, createdAt. Use to find opportunities for outreach.",
    input_schema: {
      type: "object" as const,
      properties: {
        minScore: {
          type: "number",
          description: "Minimum score filter. Defaults to 0.",
          default: 0,
        },
        status: {
          type: "string",
          description: "Filter by status: new, reviewed, actioned, dismissed.",
        },
        limit: {
          type: "number",
          description: "Max results. Defaults to 20.",
          default: 20,
        },
      },
      required: [],
    },
  },
  {
    name: "match_signal_opportunities",
    description:
      "Match a signal item to existing prospects/deals by niche, platform, and keywords. Returns ranked matches with relevance scores and suggested outreach template.",
    input_schema: {
      type: "object" as const,
      properties: {
        signalItemId: {
          type: "string",
          description: "The signal item ID to match against prospects.",
        },
        topK: {
          type: "number",
          description: "Max matches to return. Defaults to 5.",
          default: 5,
        },
      },
      required: ["signalItemId"],
    },
  },

  // ─── Agent Delegation ─────────────────────────────────────────

  {
    name: "delegate_to_agent",
    description:
      "Delegate a complex task to a specialized worker. Workers: commander (orchestration/self-healing), signal_scout (RSS/opportunity detection), outreach_writer (template personalization/drip), distribution_ops (proof-to-post scheduling), conversion_analyst (funnel analysis), followup_enforcer (stale lead/proposal escalation), proposal_architect (pricing/presentation), scope_risk_ctrl (deadline/quality gates), proof_producer (testimonial/review requests), qa_sentinel (content quality audits). Use when the task involves multiple steps within one domain.",
    input_schema: {
      type: "object" as const,
      properties: {
        agentId: {
          type: "string",
          description:
            "Worker to delegate to: commander, signal_scout, outreach_writer, distribution_ops, conversion_analyst, followup_enforcer, proposal_architect, scope_risk_ctrl, proof_producer, or qa_sentinel.",
        },
        task: {
          type: "string",
          description: "Detailed description of what the agent should do.",
        },
      },
      required: ["agentId", "task"],
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
  list_leads: "Listing leads",
  update_lead: "Updating lead",
  list_proposals: "Listing proposals",
  update_proposal: "Updating proposal",
  list_delivery_projects: "Listing delivery projects",
  update_delivery_project: "Updating delivery project",
  manage_deal: "Managing deal",
  send_operator_alert: "Sending alert",
  list_proof_records: "Listing proof records",
  schedule_content_post: "Scheduling content post",
  list_signals: "Listing signals",
  match_signal_opportunities: "Matching signal opportunities",
  delegate_to_agent: "Delegating to worker",
};

/** Tools that modify state and should be confirmed before execution. */
export const WRITE_TOOLS = new Set([
  "run_risk_rules",
  "run_next_actions",
  "recompute_score",
  "execute_nba",
  "draft_outreach",
  "update_lead",
  "update_proposal",
  "update_delivery_project",
  "manage_deal",
  "send_operator_alert",
  "schedule_content_post",
  "delegate_to_agent",
]);
