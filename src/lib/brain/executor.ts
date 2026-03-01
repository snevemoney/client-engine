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
