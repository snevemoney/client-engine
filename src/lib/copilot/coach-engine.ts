/**
 * Phase 5.1: Coach Mode deterministic engine.
 * Phase 5.3: Citations on every TopAction, safe refusal rules.
 */
import type { ScoreContext, RiskContext, NBAContext } from "./coach-tools";
import type { CoachReply, CoachResponse } from "./coach-schema";
import type { CoachSource } from "./coach-sources";
import {
  sourceScoreSnapshot,
  sourceRiskFlag,
  sourceNextAction,
  sourceApi,
} from "./coach-sources";
import { checkScoreMissing, checkScoreStale } from "./safe-refusal";

export type CoachContexts = {
  score: ScoreContext;
  risk: RiskContext;
  nba: NBAContext;
};

function formatScoreLatest(ctx: ScoreContext): string {
  if (ctx.error) return `Error: ${ctx.error}`;
  if (!ctx.latest) return "No score data";
  return `Score ${ctx.latest.score} (${ctx.latest.band}), computed ${ctx.latest.computedAt}`;
}

function formatRiskSummary(ctx: RiskContext): string {
  if (ctx.error) return `Error: ${ctx.error}`;
  const s = ctx.summary.openBySeverity;
  const total = (s.critical ?? 0) + (s.high ?? 0) + (s.medium ?? 0) + (s.low ?? 0);
  return `${total} open risks (critical: ${s.critical ?? 0}, high: ${s.high ?? 0}). Last run: ${ctx.summary.lastRunAt ?? "never"}`;
}

function formatNBASummary(ctx: NBAContext): string {
  if (ctx.error) return `Error: ${ctx.error}`;
  const q = ctx.summary.queuedByPriority;
  const total = (q.critical ?? 0) + (q.high ?? 0) + (q.medium ?? 0) + (q.low ?? 0);
  return `${total} queued (critical: ${q.critical ?? 0}, high: ${q.high ?? 0}). Last run: ${ctx.summary.lastRunAt ?? "never"}`;
}

function buildRefusalResponse(check: { message: string; suggestedAction?: string }): CoachResponse {
  const topActions: CoachReply["topActions"] = [];
  if (check.suggestedAction) {
    topActions.push({
      title: "Recompute score",
      actionKey: "recompute_score",
      why: check.suggestedAction,
      evidence: [],
      sources: [sourceApi("POST /api/internal/scores/compute", new Date().toISOString())],
      cta: {
        label: "Recompute score",
        actionKey: "recompute_score",
        modeDefault: "preview",
        requiresConfirm: true,
        payload: {},
      },
    });
  }
  return {
    reply: {
      status: "refused",
      diagnosis: check.message,
      topActions,
      risksOrUnknowns: [check.suggestedAction ?? "Refresh context to continue."],
      suggestedCommands: ["POST /api/internal/scores/compute"],
    },
    sources: {
      score: { latest: "—", recentEvents: [] },
      risk: { summary: "—", top: [] },
      nba: { summary: "—", top: [] },
    },
  };
}

export function deriveCoachResponse(
  message: string,
  contexts: CoachContexts
): CoachResponse {
  const { score, risk, nba } = contexts;
  const msgLower = message.toLowerCase().trim();

  // Phase 5.3: Safe refusal
  const scoreMissingCheck = checkScoreMissing(score, msgLower);
  if (scoreMissingCheck.shouldRefuse) {
    return buildRefusalResponse(scoreMissingCheck);
  }
  const scoreStaleCheck = checkScoreStale(score, msgLower);
  if (scoreStaleCheck.shouldRefuse) {
    return buildRefusalResponse(scoreStaleCheck);
  }

  const scoreLatest = formatScoreLatest(score);
  const riskSummary = formatRiskSummary(risk);
  const nbaSummary = formatNBASummary(nba);

  const sources = {
    score: { latest: scoreLatest, recentEvents: score.recentEvents },
    risk: { summary: riskSummary, top: risk.top },
    nba: { summary: nbaSummary, top: nba.top },
  };

  // Refusal: missing critical data (all contexts failed)
  const scoreMissing = score.error || !score.latest;
  const riskMissing = risk.error;
  const nbaMissing = nba.error;

  if (scoreMissing && riskMissing && nbaMissing) {
    const apiSource = (): CoachSource => sourceApi("POST (internal)", new Date().toISOString());
    return {
      reply: {
        status: "data_unavailable",
        diagnosis: "I can't confirm the current state yet. Score, risk, and NBA APIs failed or returned no data.",
        topActions: [
          {
            title: "Recompute score",
            actionKey: "recompute_score",
            why: "Refresh score data.",
            evidence: [],
            sources: [apiSource()],
            cta: { label: "Recompute score", actionKey: "recompute_score", modeDefault: "preview", requiresConfirm: true, payload: {} },
          },
          {
            title: "Run risk rules",
            actionKey: "run_risk_rules",
            why: "Refresh risk flags.",
            evidence: [],
            sources: [apiSource()],
            cta: { label: "Run risk rules", actionKey: "run_risk_rules", modeDefault: "preview", requiresConfirm: true, payload: {} },
          },
          {
            title: "Run next actions",
            actionKey: "run_next_actions",
            why: "Regenerate next actions.",
            evidence: [],
            sources: [apiSource()],
            cta: { label: "Run next actions", actionKey: "run_next_actions", modeDefault: "preview", requiresConfirm: true, payload: {} },
          },
        ],
        risksOrUnknowns: [
          "Score context failed. Run /api/internal/scores/compute to refresh.",
          "Risk context failed. Run /api/risk/run-rules to refresh.",
          "NBA context failed. Run /api/next-actions/run to refresh.",
        ],
        suggestedCommands: [
          "POST /api/internal/scores/compute (entityType, entityId)",
          "POST /api/risk/run-rules",
          "POST /api/next-actions/run",
        ],
      },
      sources,
    };
  }

  // Derive status
  const band = score.latest?.band ?? "unknown";
  const criticalRisks = (risk.summary.openBySeverity?.critical ?? 0) + (risk.summary.openBySeverity?.high ?? 0);
  const queuedCount = nba.top.length;

  let status: string;
  if (band === "critical") status = "Score in critical band. Prioritize recovery.";
  else if (criticalRisks > 0) status = `${criticalRisks} critical/high risks open. Prioritize remediation.`;
  else if (queuedCount > 0) status = `${queuedCount} queued next actions. Focus on top items.`;
  else status = "No urgent items. Score and risks are stable.";

  // Derive diagnosis
  const diagnosisParts: string[] = [];
  if (score.latest) {
    diagnosisParts.push(`Score: ${score.latest.score} (${score.latest.band}).`);
  }
  if (criticalRisks > 0) {
    diagnosisParts.push(`Open critical/high risks: ${criticalRisks}.`);
  }
  if (queuedCount > 0) {
    diagnosisParts.push(`Queued actions: ${queuedCount}.`);
  }
  if (diagnosisParts.length === 0) {
    diagnosisParts.push("Limited data available. Run refresh to get latest.");
  }
  const diagnosis = diagnosisParts.join(" ");

  // Top 3 actions with evidence
  const topActions: CoachReply["topActions"] = [];
  const risksOrUnknowns: string[] = [];
  const suggestedCommands: string[] = [];

  if (band === "critical" && score.latest) {
    const actionSources: CoachSource[] = [
      sourceScoreSnapshot(score.latest.id ?? "unknown", score.latest.computedAt),
      sourceApi("POST /api/internal/scores/compute", new Date().toISOString()),
    ];
    topActions.push({
      title: "Recover operator score",
      actionKey: "run_recompute_score",
      why: "Score is in critical band.",
      evidence: [`Score: ${score.latest.score}`, `Band: ${score.latest.band}`, `Computed: ${score.latest.computedAt}`],
      sources: actionSources,
      cta: {
        label: "Recompute score",
        actionKey: "recompute_score",
        modeDefault: "preview",
        requiresConfirm: true,
        payload: {},
      },
    });
    suggestedCommands.push("POST /api/internal/scores/compute");
  }

  if (criticalRisks > 0 && risk.top.length > 0) {
    const r = risk.top[0];
    const actionSources: CoachSource[] = [
      sourceRiskFlag(r.id, r.ruleKey ?? "unknown"),
      sourceApi("POST /api/risk/run-rules", new Date().toISOString()),
    ];
    topActions.push({
      title: `Address risk: ${r.title}`,
      actionKey: "view_risk",
      nextActionId: r.id,
      why: `Critical/high risk (${r.severity}).`,
      evidence: [`Risk ID: ${r.id}`, `Severity: ${r.severity}`, `Title: ${r.title}`],
      sources: actionSources,
      cta: {
        label: "Run risk rules",
        actionKey: "run_risk_rules",
        modeDefault: "preview",
        requiresConfirm: true,
        payload: {},
      },
    });
    risksOrUnknowns.push(`Open risk: ${r.title} (${r.severity})`);
  }

  if (nba.top.length > 0) {
    for (const a of nba.top.slice(0, 3 - topActions.length)) {
      if (topActions.length >= 3) break;
      const actionSources: CoachSource[] = [
        sourceNextAction(a.id, a.ruleKey ?? "unknown", a.dedupeKey ?? a.id),
        sourceApi("POST /api/next-actions/[id]/execute", new Date().toISOString()),
      ];
      topActions.push({
        title: a.title,
        actionKey: "execute_nba",
        nextActionId: a.id,
        why: a.reason ?? `Priority ${a.priority}, score ${a.score}`,
        evidence: [`NBA ID: ${a.id}`, `Priority: ${a.priority}`, `Score: ${a.score}`],
        sources: actionSources,
        cta: {
          label: "Mark done",
          actionKey: "nba_execute",
          modeDefault: "preview",
          requiresConfirm: true,
          payload: { nextActionId: a.id, nbaActionKey: "mark_done" },
        },
      });
    }
  }

  if (scoreMissing) {
    risksOrUnknowns.push("Score data unavailable. Run compute to refresh.");
    suggestedCommands.push("POST /api/internal/scores/compute");
  }
  if (riskMissing) {
    risksOrUnknowns.push("Risk data unavailable. Run risk rules to refresh.");
    suggestedCommands.push("POST /api/risk/run-rules");
  }
  if (nbaMissing) {
    risksOrUnknowns.push("NBA data unavailable. Run next actions to refresh.");
    suggestedCommands.push("POST /api/next-actions/run");
  }

  return {
    reply: {
      status,
      diagnosis,
      topActions: topActions.slice(0, 3),
      risksOrUnknowns,
      suggestedCommands: [...new Set(suggestedCommands)],
    },
    sources,
  };
}
