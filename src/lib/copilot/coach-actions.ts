/**
 * Phase 5.2: Coach Mode action execution.
 * Preview builder, execute logic, before/after diff summarizer.
 */
import type { CoachFetchOptions } from "./coach-tools";
import {
  getScoreContext,
  getRiskContext,
  getNBAContext,
  runRecomputeScore,
  runRiskRules,
  runNextActions,
} from "./coach-tools";
import { runDeliveryAction } from "@/lib/next-actions/delivery-actions";

export const COACH_ACTION_KEYS = [
  "run_risk_rules",
  "run_next_actions",
  "recompute_score",
  "nba_execute",
] as const;

export type CoachActionKey = (typeof COACH_ACTION_KEYS)[number];

export const NBA_ACTION_KEYS = [
  "mark_done",
  "snooze_1d",
  "dismiss",
  "don_t_suggest_again_30d",
] as const;

export type CoachActionInput = {
  actionKey: CoachActionKey;
  mode: "preview" | "execute";
  entityType: string;
  entityId: string;
  nextActionId?: string;
  nbaActionKey?: string;
};

export type ContextSnapshot = {
  score: string;
  risk: string;
  nba: string;
};

export type ActionPreview = {
  summary: string;
  steps: string[];
  warnings: string[];
};

export type ActionExecution = {
  executionId?: string;
  resultSummary: string;
  errors: string[];
};

export type ActionResponse = {
  ok: boolean;
  preview?: ActionPreview;
  execution?: ActionExecution;
  before?: ContextSnapshot;
  after?: ContextSnapshot;
  error?: string;
};

async function fetchContextSnapshot(
  entityType: string,
  entityId: string,
  opts: CoachFetchOptions
): Promise<ContextSnapshot> {
  const [score, risk, nba] = await Promise.all([
    getScoreContext(entityType, entityId, opts),
    getRiskContext(entityType, entityId, opts),
    getNBAContext(entityType, entityId, opts),
  ]);

  const scoreStr = score.error
    ? `Error: ${score.error}`
    : score.latest
      ? `Score ${score.latest.score} (${score.latest.band})`
      : "No score";
  const riskStr = risk.error
    ? `Error: ${risk.error}`
    : `Open: ${(risk.summary.openBySeverity?.critical ?? 0) + (risk.summary.openBySeverity?.high ?? 0)} critical/high`;
  const nbaStr = nba.error
    ? `Error: ${nba.error}`
    : `Queued: ${(nba.summary.queuedByPriority?.critical ?? 0) + (nba.summary.queuedByPriority?.high ?? 0) + (nba.summary.queuedByPriority?.medium ?? 0) + (nba.summary.queuedByPriority?.low ?? 0)}`;

  return { score: scoreStr, risk: riskStr, nba: nbaStr };
}

export function buildPreview(
  actionKey: CoachActionKey,
  input: CoachActionInput,
  before: ContextSnapshot
): ActionPreview {
  const warnings: string[] = [];

  switch (actionKey) {
    case "run_risk_rules":
      return {
        summary: "Evaluate risk rules and upsert flags. Will read rule context and create/update risk flags.",
        steps: [
          "Fetch risk rule context (proposals, reminders, handoffs, etc.)",
          "Evaluate rules against context",
          "Upsert risk flags (create new, update existing)",
        ],
        warnings: before.risk.startsWith("Error")
          ? ["Risk context unavailable. Run may produce partial results."]
          : [],
      };

    case "run_next_actions":
      return {
        summary: `Regenerate next actions for scope ${input.entityType}/${input.entityId}. Will produce ranked actions from rules.`,
        steps: [
          "Fetch NBA context (scores, risks, proposals, etc.)",
          "Produce candidates from rules",
          "Filter by preferences",
          "Upsert next actions",
        ],
        warnings: before.nba.startsWith("Error")
          ? ["NBA context may be stale. Results depend on current data."]
          : [],
      };

    case "recompute_score":
      return {
        summary: `Recompute operator score for ${input.entityType}/${input.entityId}. Reads snapshot history and factors.`,
        steps: [
          "Load previous snapshots and events",
          "Compute factors (throughput, conversion, etc.)",
          "Store new snapshot and events",
        ],
        warnings: before.score.startsWith("Error")
          ? ["Score history may be incomplete."]
          : [],
      };

    case "nba_execute":
      if (!input.nextActionId || !input.nbaActionKey) {
        return {
          summary: "Missing nextActionId or nbaActionKey.",
          steps: [],
          warnings: ["nextActionId and nbaActionKey are required for nba_execute."],
        };
      }
      const reversible = ["snooze_1d"].includes(input.nbaActionKey);
      const destructive = ["dismiss", "don_t_suggest_again_30d"].includes(input.nbaActionKey);
      return {
        summary: `Execute ${input.nbaActionKey} on NBA ${input.nextActionId}. ${reversible ? "Reversible (snooze)." : destructive ? "Not reversible." : "Marks as done."}`,
        steps: [
          `Transition NBA ${input.nextActionId} to ${input.nbaActionKey}`,
          destructive ? "Action will be removed from queued list." : "Action status will update.",
        ],
        warnings: destructive ? ["This action is not easily reversible."] : [],
      };

    default:
      return {
        summary: "Unknown action.",
        steps: [],
        warnings: ["Action not supported."],
      };
  }
}

export function summarizeDiff(before: ContextSnapshot, after: ContextSnapshot): string {
  const parts: string[] = [];
  if (before.score !== after.score) parts.push(`Score: ${before.score} → ${after.score}`);
  if (before.risk !== after.risk) parts.push(`Risks: ${before.risk} → ${after.risk}`);
  if (before.nba !== after.nba) parts.push(`NBA: ${before.nba} → ${after.nba}`);
  return parts.length > 0 ? parts.join(". ") : "No visible change in context.";
}

export async function runCoachAction(
  input: CoachActionInput,
  opts: CoachFetchOptions,
  actorUserId?: string
): Promise<ActionResponse> {
  const before = await fetchContextSnapshot(input.entityType, input.entityId, opts);
  const preview = buildPreview(input.actionKey, input, before);

  if (input.mode === "preview") {
    return {
      ok: true,
      preview,
      before,
    };
  }

  const errors: string[] = [];

  try {
    let resultSummary = "";
    let executionId: string | undefined;

    switch (input.actionKey) {
      case "run_risk_rules": {
        const r = await runRiskRules(opts);
        if (!r.ok) {
          errors.push(r.error ?? "Run failed");
          resultSummary = `Risk rules failed: ${r.error}`;
        } else {
          const data = r.data as { created?: number; updated?: number };
          resultSummary = `Risk rules completed. Created: ${data?.created ?? 0}, Updated: ${data?.updated ?? 0}`;
        }
        break;
      }

      case "run_next_actions": {
        const r = await runNextActions(input.entityType, input.entityId, opts);
        if (!r.ok) {
          errors.push(r.error ?? "Run failed");
          resultSummary = `Next actions run failed: ${r.error}`;
        } else {
          const data = r.data as { created?: number; updated?: number };
          resultSummary = `Next actions completed. Created: ${data?.created ?? 0}, Updated: ${data?.updated ?? 0}`;
        }
        break;
      }

      case "recompute_score": {
        const r = await runRecomputeScore(input.entityType, input.entityId, opts);
        if (!r.ok) {
          errors.push(r.error ?? "Compute failed");
          resultSummary = `Score compute failed: ${r.error}`;
        } else {
          const data = r.data as { score?: number; band?: string };
          resultSummary = `Score recomputed: ${data?.score ?? "—"} (${data?.band ?? "—"})`;
        }
        break;
      }

      case "nba_execute": {
        if (!input.nextActionId || !input.nbaActionKey) {
          return {
            ok: false,
            error: "nextActionId and nbaActionKey required for nba_execute",
            preview,
            before,
          };
        }
        if (!NBA_ACTION_KEYS.includes(input.nbaActionKey as (typeof NBA_ACTION_KEYS)[number])) {
          return {
            ok: false,
            error: `nbaActionKey must be one of: ${NBA_ACTION_KEYS.join(", ")}`,
            preview,
            before,
          };
        }
        const r = await runDeliveryAction({
          nextActionId: input.nextActionId,
          actionKey: input.nbaActionKey,
          actorUserId,
        });
        if (!r.ok) {
          errors.push(r.errorMessage ?? "Execute failed");
          resultSummary = `NBA execute failed: ${r.errorMessage}`;
        } else {
          executionId = r.executionId;
          resultSummary = `Action ${input.nbaActionKey} completed on NBA ${input.nextActionId}.`;
        }
        break;
      }

      default:
        return {
          ok: false,
          error: `Unknown actionKey: ${input.actionKey}`,
          preview,
          before,
        };
    }

    const after = await fetchContextSnapshot(input.entityType, input.entityId, opts);
    const diffSummary = summarizeDiff(before, after);

    return {
      ok: errors.length === 0,
      preview,
      execution: {
        executionId,
        resultSummary: errors.length > 0 ? resultSummary : `${resultSummary} ${diffSummary}`,
        errors,
      },
      before,
      after,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    let after: ContextSnapshot | undefined;
    try {
      after = await fetchContextSnapshot(input.entityType, input.entityId, opts);
    } catch {
      after = undefined;
    }
    return {
      ok: false,
      preview,
      execution: { resultSummary: msg, errors: [msg] },
      before,
      after,
    };
  }
}
