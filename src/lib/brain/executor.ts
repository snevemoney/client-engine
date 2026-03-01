/**
 * AI Brain tool executor.
 * Dispatches tool calls to existing internal functions.
 * Read tools call library functions directly. Write tools go through
 * existing action paths to preserve side-effects (memory, attribution, ops events).
 */
import {
  getScoreContext,
  getRiskContext,
  getNBAContext,
  runRecomputeScore,
  runRiskRules as coachRunRiskRules,
  runNextActions as coachRunNextActions,
  type CoachFetchOptions,
} from "@/lib/copilot/coach-tools";
import { WRITE_TOOLS } from "./tools";

export type ToolContext = {
  userId: string;
  baseUrl: string;
  cookie?: string;
  entityType: string;
  entityId: string;
};

export type ToolResult = {
  result: unknown;
  error?: string;
};

function fetchOpts(ctx: ToolContext): CoachFetchOptions {
  return { baseUrl: ctx.baseUrl, cookie: ctx.cookie };
}

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOLS.has(toolName);
}

// ─── Read Tools ────────────────────────────────────────────────

async function executeGetBusinessSnapshot(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const entityType = (input.entityType as string) || ctx.entityType;
  const entityId = (input.entityId as string) || ctx.entityId;
  const opts = fetchOpts(ctx);

  const [score, risk, nba] = await Promise.all([
    getScoreContext(entityType, entityId, opts),
    getRiskContext(entityType, entityId, opts),
    getNBAContext(entityType, entityId, opts),
  ]);

  return {
    result: { score, risk, nba },
    error: score.error || risk.error || nba.error || undefined,
  };
}

async function executeGetExecutiveBrief(ctx: ToolContext): Promise<ToolResult> {
  try {
    const { getExecutiveBriefContext } = await import(
      "@/lib/ops/executiveBrief"
    );
    const brief = await getExecutiveBriefContext();
    return { result: brief };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Failed to fetch executive brief",
    };
  }
}

async function executeGetPipeline(ctx: ToolContext): Promise<ToolResult> {
  try {
    const { buildBrief } = await import("@/lib/orchestrator/brief");
    const brief = await buildBrief();
    return { result: brief };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Failed to fetch pipeline",
    };
  }
}

async function executeGetGrowthSummary(ctx: ToolContext): Promise<ToolResult> {
  try {
    const { computeGrowthSummary } = await import("@/lib/growth/summary");
    const summary = await computeGrowthSummary(ctx.userId);
    return { result: summary };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Failed to fetch growth summary",
    };
  }
}

async function executeSearchKnowledge(
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const { searchArtifacts } = await import("@/lib/pinecone");
    const query = (input.query as string) || "";
    const topK = (input.topK as number) || 5;
    const results = await searchArtifacts(query, { topK });
    return { result: results };
  } catch (e) {
    return {
      result: [],
      error:
        e instanceof Error ? e.message : "Failed to search knowledge base",
    };
  }
}

async function executeGetMemoryPatterns(
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const { loadLearnedWeights } = await import("@/lib/memory/weights");
    const { computeWindowStats, computeTrendDiffs, derivePolicySuggestions } =
      await import("@/lib/memory/policy");

    const weights = await loadLearnedWeights(ctx.userId);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const priorWeek = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [currentStats, priorStats] = await Promise.all([
      computeWindowStats(ctx.userId, weekAgo, now),
      computeWindowStats(ctx.userId, priorWeek, weekAgo),
    ]);

    const diffs = computeTrendDiffs(currentStats, priorStats);
    const suggestions = derivePolicySuggestions(currentStats, diffs);

    return {
      result: {
        topRuleWeights: [...weights.ruleWeights.entries()]
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([key, weight]) => ({ key, weight })),
        topActionWeights: [...weights.actionWeights.entries()]
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([key, weight]) => ({ key, weight })),
        trendDiffs: diffs.recurring.slice(0, 5),
        policySuggestions: suggestions.slice(0, 5),
      },
    };
  } catch (e) {
    return {
      result: null,
      error:
        e instanceof Error ? e.message : "Failed to load memory patterns",
    };
  }
}

async function executeGetOpsHealth(): Promise<ToolResult> {
  try {
    const { getOpsHealth } = await import("@/lib/ops/opsHealth");
    const health = await getOpsHealth();
    return { result: health };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Failed to fetch ops health",
    };
  }
}

// ─── Write Tools ───────────────────────────────────────────────

async function executeRunRiskRules(ctx: ToolContext): Promise<ToolResult> {
  const result = await coachRunRiskRules(fetchOpts(ctx));
  return result.ok
    ? { result: result.data }
    : { result: null, error: result.error };
}

async function executeRunNextActions(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const entityType = (input.entityType as string) || ctx.entityType;
  const entityId = (input.entityId as string) || ctx.entityId;
  const result = await coachRunNextActions(entityType, entityId, fetchOpts(ctx));
  return result.ok
    ? { result: result.data }
    : { result: null, error: result.error };
}

async function executeRecomputeScore(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const entityType = (input.entityType as string) || ctx.entityType;
  const entityId = (input.entityId as string) || ctx.entityId;
  const result = await runRecomputeScore(entityType, entityId, fetchOpts(ctx));
  return result.ok
    ? { result: result.data }
    : { result: null, error: result.error };
}

async function executeNBA(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const { runDeliveryAction } = await import(
      "@/lib/next-actions/delivery-actions"
    );
    const nextActionId = input.nextActionId as string;
    const actionKey = input.actionKey as string;
    if (!nextActionId || !actionKey) {
      return { result: null, error: "nextActionId and actionKey are required" };
    }
    const result = await runDeliveryAction({
      nextActionId,
      actionKey,
      actorUserId: ctx.userId,
    });
    return result.ok
      ? { result: { executionId: result.executionId } }
      : { result: null, error: result.errorMessage || result.errorCode };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Failed to execute NBA",
    };
  }
}

async function executeDraftOutreach(
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const { getTemplate, renderTemplate } = await import(
      "@/lib/growth/templates"
    );
    const templateKey = input.templateKey as string;
    const variables = (input.variables as Record<string, string>) || {};
    const template = getTemplate(templateKey);
    if (!template) {
      return {
        result: null,
        error: `Unknown template: ${templateKey}. Available: broken_link_fix, google_form_upgrade, linktree_cleanup, big_audience_no_site, canva_site_upgrade, calendly_blank_fix`,
      };
    }
    const rendered = renderTemplate(template, variables);
    return { result: { templateKey, rendered, nextFollowUpDays: template.nextFollowUpDays } };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Failed to draft outreach",
    };
  }
}

// ─── CRUD Tools (Phase 9: Multi-Agent) ────────────────────────

async function executeListLeads(
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const { db } = await import("@/lib/db");
    const status = input.status as string | undefined;
    const limit = Math.min((input.limit as number) || 20, 50);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const leads = await db.lead.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        source: true,
        contactName: true,
        contactEmail: true,
        score: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { result: { count: leads.length, leads } };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Failed to list leads" };
  }
}

async function executeUpdateLead(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const { db } = await import("@/lib/db");
    const leadId = input.leadId as string;
    if (!leadId) return { result: null, error: "leadId is required" };

    const before = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, status: true, score: true } });
    if (!before) return { result: null, error: "Lead not found" };

    const data: Record<string, unknown> = {};
    if (input.status) data.status = input.status;
    if (input.description) data.description = input.description;
    if (input.score !== undefined) data.score = input.score;
    if (input.scoreReason) data.scoreReason = input.scoreReason;

    if (Object.keys(data).length === 0) return { result: null, error: "No fields to update" };

    const after = await db.lead.update({ where: { id: leadId }, data, select: { id: true, status: true, score: true, title: true } });

    const { logOpsEventSafe } = await import("@/lib/ops-events/log");
    const { sanitizeMeta } = await import("@/lib/ops-events/sanitize");
    logOpsEventSafe({
      category: "api_action",
      eventKey: "agent.update_lead",
      actorType: "ai",
      actorId: ctx.userId,
      meta: sanitizeMeta({ leadId, before, after }),
    });

    return { result: { before, after } };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Failed to update lead" };
  }
}

async function executeListProposals(
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const { db } = await import("@/lib/db");
    const status = input.status as string | undefined;
    const limit = Math.min((input.limit as number) || 20, 50);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const proposals = await db.proposal.findMany({
      where,
      select: {
        id: true,
        title: true,
        clientName: true,
        status: true,
        priceMin: true,
        priceMax: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { result: { count: proposals.length, proposals } };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Failed to list proposals" };
  }
}

async function executeUpdateProposal(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const { db } = await import("@/lib/db");
    const proposalId = input.proposalId as string;
    if (!proposalId) return { result: null, error: "proposalId is required" };

    const before = await db.proposal.findUnique({ where: { id: proposalId }, select: { id: true, status: true, priceMin: true, priceMax: true } });
    if (!before) return { result: null, error: "Proposal not found" };

    const data: Record<string, unknown> = {};
    if (input.status) data.status = input.status;
    if (input.priceMin !== undefined) data.priceMin = input.priceMin;
    if (input.priceMax !== undefined) data.priceMax = input.priceMax;
    if (input.summary) data.summary = input.summary;

    if (Object.keys(data).length === 0) return { result: null, error: "No fields to update" };

    const after = await db.proposal.update({ where: { id: proposalId }, data, select: { id: true, status: true, priceMin: true, priceMax: true, title: true } });

    const { logOpsEventSafe } = await import("@/lib/ops-events/log");
    const { sanitizeMeta } = await import("@/lib/ops-events/sanitize");
    logOpsEventSafe({
      category: "api_action",
      eventKey: "agent.update_proposal",
      actorType: "ai",
      actorId: ctx.userId,
      meta: sanitizeMeta({ proposalId, before, after }),
    });

    return { result: { before, after } };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Failed to update proposal" };
  }
}

async function executeListDeliveryProjects(
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const { db } = await import("@/lib/db");
    const status = input.status as string | undefined;
    const limit = Math.min((input.limit as number) || 20, 50);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const projects = await db.deliveryProject.findMany({
      where,
      select: {
        id: true,
        title: true,
        clientName: true,
        status: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { result: { count: projects.length, projects } };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Failed to list delivery projects" };
  }
}

async function executeUpdateDeliveryProject(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const { db } = await import("@/lib/db");
    const projectId = input.projectId as string;
    if (!projectId) return { result: null, error: "projectId is required" };

    const before = await db.deliveryProject.findUnique({ where: { id: projectId }, select: { id: true, status: true, dueDate: true } });
    if (!before) return { result: null, error: "Delivery project not found" };

    const data: Record<string, unknown> = {};
    if (input.status) {
      data.status = input.status;
      if (input.status === "completed") data.completedAt = new Date();
    }
    if (input.deliveryNotes) data.deliveryNotes = input.deliveryNotes;
    if (input.dueDate) data.dueDate = new Date(input.dueDate as string);

    if (Object.keys(data).length === 0) return { result: null, error: "No fields to update" };

    const after = await db.deliveryProject.update({ where: { id: projectId }, data, select: { id: true, status: true, dueDate: true, title: true } });

    const { logOpsEventSafe } = await import("@/lib/ops-events/log");
    const { sanitizeMeta } = await import("@/lib/ops-events/sanitize");
    logOpsEventSafe({
      category: "api_action",
      eventKey: "agent.update_delivery",
      actorType: "ai",
      actorId: ctx.userId,
      meta: sanitizeMeta({ projectId, before, after }),
    });

    return { result: { before, after } };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Failed to update delivery project" };
  }
}

async function executeManageDeal(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const { db } = await import("@/lib/db");
    const dealId = input.dealId as string;
    if (!dealId) return { result: null, error: "dealId is required" };

    const deal = await db.deal.findFirst({ where: { id: dealId, ownerUserId: ctx.userId } });
    if (!deal) return { result: null, error: "Deal not found" };

    const before = { stage: deal.stage, priority: deal.priority, nextFollowUpAt: deal.nextFollowUpAt };
    const data: Record<string, unknown> = {};

    if (input.stage) data.stage = input.stage;
    if (input.priority) data.priority = input.priority;
    if (input.nextFollowUpDays) {
      const next = new Date();
      next.setDate(next.getDate() + (input.nextFollowUpDays as number));
      data.nextFollowUpAt = next;
    }

    if (Object.keys(data).length > 0) {
      await db.deal.update({ where: { id: dealId }, data });
    }

    if (input.notes) {
      await db.outreachEvent.create({
        data: {
          ownerUserId: ctx.userId,
          dealId,
          channel: "other",
          type: "sent",
          occurredAt: new Date(),
          metaJson: { notes: input.notes, source: "agent" },
        },
      });
    }

    const after = await db.deal.findUnique({ where: { id: dealId }, select: { stage: true, priority: true, nextFollowUpAt: true } });

    const { logOpsEventSafe } = await import("@/lib/ops-events/log");
    const { sanitizeMeta } = await import("@/lib/ops-events/sanitize");
    logOpsEventSafe({
      category: "api_action",
      eventKey: "agent.manage_deal",
      actorType: "ai",
      actorId: ctx.userId,
      meta: sanitizeMeta({ dealId, before, after }),
    });

    return { result: { before, after } };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Failed to manage deal" };
  }
}

async function executeSendOperatorAlert(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const { createNotificationEvent, queueNotificationDeliveries } = await import("@/lib/notifications/service");
    const title = input.title as string;
    const message = input.message as string;
    if (!title || !message) return { result: null, error: "title and message are required" };

    const severity = (input.severity as string) || "info";
    const validSeverities = ["info", "warning", "critical"];
    if (!validSeverities.includes(severity)) {
      return { result: null, error: `Invalid severity. Use: ${validSeverities.join(", ")}` };
    }

    const { id: eventId, created } = await createNotificationEvent({
      eventKey: "agent.operator_alert",
      title,
      message,
      severity: severity as "info" | "warning" | "critical",
      sourceType: "agent",
      actionUrl: (input.actionUrl as string) || null,
      dedupeKey: `agent:alert:${title.slice(0, 50)}:${new Date().toISOString().slice(0, 13)}`,
      createdByRule: "agent.send_operator_alert",
    });

    if (created) {
      await queueNotificationDeliveries(eventId, ["in_app"]);
    }

    return { result: { eventId, created, severity } };
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : "Failed to send alert" };
  }
}

// ─── Agent Delegation ──────────────────────────────────────────

async function executeDelegateToAgent(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const { runAgent } = await import("@/lib/agents/runner");
    const agentId = input.agentId as string;
    const task = input.task as string;
    if (!agentId || !task) {
      return { result: null, error: "agentId and task are required" };
    }

    const validAgents = ["revenue", "delivery", "growth", "retention", "intelligence", "system"];
    if (!validAgents.includes(agentId)) {
      return { result: null, error: `Invalid agentId. Valid: ${validAgents.join(", ")}` };
    }

    const result = await runAgent(
      agentId as import("@/lib/agents/types").AgentId,
      task,
      ctx,
      { triggerType: "brain_delegation" }
    );

    return {
      result: {
        agentRunId: result.agentRunId,
        agentId,
        status: result.status,
        resultSummary: result.resultSummary,
        toolCallCount: result.toolCalls.length,
        pendingApprovals: result.pendingApprovals,
      },
      error: result.status === "failed" ? result.resultSummary : undefined,
    };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Failed to delegate to agent",
    };
  }
}

// ─── Dispatcher ────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "get_business_snapshot":
        return executeGetBusinessSnapshot(input, ctx);
      case "get_executive_brief":
        return executeGetExecutiveBrief(ctx);
      case "get_pipeline":
        return executeGetPipeline(ctx);
      case "get_growth_summary":
        return executeGetGrowthSummary(ctx);
      case "search_knowledge":
        return executeSearchKnowledge(input);
      case "get_memory_patterns":
        return executeGetMemoryPatterns(ctx);
      case "run_risk_rules":
        return executeRunRiskRules(ctx);
      case "run_next_actions":
        return executeRunNextActions(input, ctx);
      case "recompute_score":
        return executeRecomputeScore(input, ctx);
      case "execute_nba":
        return executeNBA(input, ctx);
      case "draft_outreach":
        return executeDraftOutreach(input);
      case "get_ops_health":
        return executeGetOpsHealth();
      case "list_leads":
        return executeListLeads(input);
      case "update_lead":
        return executeUpdateLead(input, ctx);
      case "list_proposals":
        return executeListProposals(input);
      case "update_proposal":
        return executeUpdateProposal(input, ctx);
      case "list_delivery_projects":
        return executeListDeliveryProjects(input);
      case "update_delivery_project":
        return executeUpdateDeliveryProject(input, ctx);
      case "manage_deal":
        return executeManageDeal(input, ctx);
      case "send_operator_alert":
        return executeSendOperatorAlert(input, ctx);
      case "delegate_to_agent":
        return executeDelegateToAgent(input, ctx);
      default:
        return { result: null, error: `Unknown tool: ${toolName}` };
    }
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : `Tool ${toolName} failed`,
    };
  }
}
