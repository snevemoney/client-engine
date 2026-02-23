/**
 * Client Success Layer: load/save result target, baseline, interventions,
 * outcome scorecard, risks, feedback. Used for delivery tracking and proof generation.
 */

import { db } from "@/lib/db";
import type {
  ResultTarget,
  BaselineSnapshot,
  InterventionEntry,
  OutcomeEntry,
  RiskItem,
  ClientFeedbackEntry,
  ReusableAssetEntry,
  ClientSuccessData,
  ResultsLedgerExtra,
} from "./types";
import { ARTIFACT_TYPES } from "./types";

function safeJson<T>(meta: unknown, guard: (m: unknown) => m is T): T | null {
  if (meta == null || typeof meta !== "object") return null;
  return guard(meta) ? meta : null;
}

export async function getClientSuccessData(leadId: string): Promise<ClientSuccessData> {
  const artifacts = await db.artifact.findMany({
    where: { leadId },
    orderBy: { createdAt: "asc" },
  });

  let resultTarget: ResultTarget | null = null;
  let baseline: BaselineSnapshot | null = null;
  let interventions: InterventionEntry[] = [];
  let outcomeEntries: OutcomeEntry[] = [];
  let risks: RiskItem[] = [];
  let feedback: ClientFeedbackEntry[] = [];
  let reusableAssets: ReusableAssetEntry[] = [];
  let resultLedgerExtra: ResultsLedgerExtra | null = null;

  for (const a of artifacts) {
    if (a.type === ARTIFACT_TYPES.RESULT_TARGET && a.meta) {
      const m = a.meta as Record<string, unknown>;
      if (m.currentState != null && m.targetState != null && m.metric != null && m.timeline != null) {
        resultTarget = {
          currentState: String(m.currentState),
          targetState: String(m.targetState),
          metric: String(m.metric),
          timeline: String(m.timeline),
          capturedAt: (m.capturedAt as string) || a.createdAt.toISOString(),
        };
      }
    } else if (a.type === ARTIFACT_TYPES.BASELINE_SNAPSHOT && a.meta) {
      const m = a.meta as Record<string, unknown>;
      if (Array.isArray(m.metrics)) {
        baseline = {
          metrics: (m.metrics as { name: string; value: string; unit?: string }[]).map((x) => ({
            name: String(x?.name ?? ""),
            value: String(x?.value ?? ""),
            unit: x?.unit != null ? String(x.unit) : undefined,
          })),
          notes: m.notes != null ? String(m.notes) : undefined,
          capturedAt: (m.capturedAt as string) || a.createdAt.toISOString(),
        };
      }
    } else if (a.type === ARTIFACT_TYPES.INTERVENTION_LOG && a.meta) {
      const m = a.meta as { entries?: unknown[] };
      if (Array.isArray(m.entries)) {
        interventions = (m.entries as InterventionEntry[]).filter(
          (e) => e && typeof e.id === "string" && typeof e.description === "string"
        );
      }
    } else if (a.type === ARTIFACT_TYPES.OUTCOME_SCORECARD && a.meta) {
      const m = a.meta as { entries?: unknown[] };
      if (Array.isArray(m.entries)) {
        outcomeEntries = (m.entries as OutcomeEntry[]).filter(
          (e) => e && typeof e.id === "string" && Array.isArray(e.metrics)
        );
      }
    } else if (a.type === ARTIFACT_TYPES.RISK_BOTTLENECK_LOG && a.meta) {
      const m = a.meta as { items?: unknown[] };
      if (Array.isArray(m.items)) {
        risks = (m.items as RiskItem[]).filter((e) => e && typeof e.id === "string" && typeof e.description === "string");
      }
    } else if (a.type === ARTIFACT_TYPES.CLIENT_FEEDBACK_LOG && a.meta) {
      const m = a.meta as { entries?: unknown[] };
      if (Array.isArray(m.entries)) {
        feedback = (m.entries as ClientFeedbackEntry[]).filter(
          (e) => e && typeof e.id === "string" && typeof e.response === "string"
        );
      }
    } else if (a.type === ARTIFACT_TYPES.REUSABLE_ASSET_LOG && a.meta) {
      const m = a.meta as { entries?: unknown[] };
      if (Array.isArray(m.entries)) {
        reusableAssets = (m.entries as ReusableAssetEntry[]).filter(
          (e) => e && typeof e.id === "string" && typeof e.description === "string" && typeof e.kind === "string"
        );
      }
    } else if (a.type === ARTIFACT_TYPES.RESULTS_LEDGER_EXTRA && a.meta) {
      const m = a.meta as Record<string, unknown>;
      resultLedgerExtra = {
        currentResult: m.currentResult != null ? String(m.currentResult) : undefined,
        delta: m.delta != null ? String(m.delta) : undefined,
        whatWorked: m.whatWorked != null ? String(m.whatWorked) : undefined,
        whatFailed: m.whatFailed != null ? String(m.whatFailed) : undefined,
        outcomeConfidence: ["observed", "inferred", "not_enough_data"].includes(String(m.outcomeConfidence))
          ? (m.outcomeConfidence as ResultsLedgerExtra["outcomeConfidence"])
          : undefined,
        nextActionRecommendation: ["upsell", "optimize", "closeout", "case_study", "follow_up", "none"].includes(
          String(m.nextActionRecommendation)
        )
          ? (m.nextActionRecommendation as ResultsLedgerExtra["nextActionRecommendation"])
          : undefined,
      };
    }
  }

  return {
    resultTarget,
    baseline,
    interventions,
    outcomeEntries: outcomeEntries.sort(
      (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
    ),
    risks: risks.filter((r) => !r.resolvedAt),
    feedback,
    reusableAssets,
    resultsLedgerExtra: resultLedgerExtra ?? undefined,
  };
}

const REUSABLE_ASSET_KINDS = ["template", "component", "workflow", "playbook", "case_study", "marketing_angle", "other"] as const;

export async function appendReusableAsset(
  leadId: string,
  entry: Omit<ReusableAssetEntry, "id" | "at">
): Promise<void> {
  const kind = REUSABLE_ASSET_KINDS.includes(entry.kind as (typeof REUSABLE_ASSET_KINDS)[number])
    ? entry.kind
    : "other";
  const full: ReusableAssetEntry = {
    ...entry,
    kind,
    id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const data = await getClientSuccessData(leadId);
  const entries = [...data.reusableAssets, full];
  await saveReusableAssetLog(leadId, entries);
}

async function saveReusableAssetLog(leadId: string, entries: ReusableAssetEntry[]): Promise<void> {
  const content =
    "# Reusable Assets\n\n" +
    entries
      .map(
        (e) =>
          `## ${e.at}\n**${e.kind}**\n${e.description}${e.usedInProject ? `\nUsed in: ${e.usedInProject}` : ""}`
      )
      .join("\n\n---\n\n");
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.REUSABLE_ASSET_LOG },
    select: { id: true },
  });
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta: { entries } },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPES.REUSABLE_ASSET_LOG,
        title: "REUSABLE_ASSET_LOG",
        content,
        meta: { entries },
      },
    });
  }
}

export async function upsertResultTarget(leadId: string, payload: Omit<ResultTarget, "capturedAt">): Promise<void> {
  const data: ResultTarget = { ...payload, capturedAt: new Date().toISOString() };
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.RESULT_TARGET },
    select: { id: true },
  });
  const content = `# Result Target\n\n**Current:** ${payload.currentState}\n**Target:** ${payload.targetState}\n**Metric:** ${payload.metric}\n**Timeline:** ${payload.timeline}`;
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta: data },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPES.RESULT_TARGET,
        title: "RESULT_TARGET",
        content,
        meta: data,
      },
    });
  }
}

export async function upsertBaselineSnapshot(
  leadId: string,
  payload: Omit<BaselineSnapshot, "capturedAt">
): Promise<void> {
  const data: BaselineSnapshot = { ...payload, capturedAt: new Date().toISOString() };
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.BASELINE_SNAPSHOT },
    select: { id: true },
  });
  const content =
    "# Baseline Snapshot\n\n" +
    data.metrics.map((m) => `- ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ""}`).join("\n") +
    (data.notes ? `\n\n${data.notes}` : "");
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta: data },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPES.BASELINE_SNAPSHOT,
        title: "BASELINE_SNAPSHOT",
        content,
        meta: data,
      },
    });
  }
}

export async function appendIntervention(
  leadId: string,
  entry: Omit<InterventionEntry, "id" | "at">
): Promise<void> {
  const full: InterventionEntry = {
    ...entry,
    id: `i-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const data = await getClientSuccessData(leadId);
  const entries = [...data.interventions, full];
  await saveInterventionLog(leadId, entries);
}

async function saveInterventionLog(leadId: string, entries: InterventionEntry[]): Promise<void> {
  const content =
    "# Intervention Log\n\n" +
    entries
      .map(
        (e) =>
          `## ${e.at}\n**${e.category}**\n${e.description}${e.impact ? `\nImpact: ${e.impact}` : ""}`
      )
      .join("\n\n---\n\n");
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.INTERVENTION_LOG },
    select: { id: true },
  });
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta: { entries } },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPES.INTERVENTION_LOG,
        title: "INTERVENTION_LOG",
        content,
        meta: { entries },
      },
    });
  }
}

export async function appendOutcomeEntry(
  leadId: string,
  entry: Omit<OutcomeEntry, "id">
): Promise<void> {
  const full: OutcomeEntry = {
    ...entry,
    id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const data = await getClientSuccessData(leadId);
  const entries = [full, ...data.outcomeEntries];
  await saveOutcomeScorecard(leadId, entries);
}

async function saveOutcomeScorecard(leadId: string, entries: OutcomeEntry[]): Promise<void> {
  const content =
    "# Outcome Scorecard\n\n" +
    entries
      .map(
        (e) =>
          `## Week ${e.weekStart}\n${e.metrics.map((m) => `- ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ""}${m.delta ? ` (${m.delta})` : ""}`).join("\n")}${e.notes ? `\n${e.notes}` : ""}`
      )
      .join("\n\n---\n\n");
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.OUTCOME_SCORECARD },
    select: { id: true },
  });
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta: { entries } },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPES.OUTCOME_SCORECARD,
        title: "OUTCOME_SCORECARD",
        content,
        meta: { entries },
      },
    });
  }
}

async function getAllRiskItems(leadId: string): Promise<RiskItem[]> {
  const artifact = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.RISK_BOTTLENECK_LOG },
  });
  const items = (artifact?.meta as { items?: RiskItem[] })?.items ?? [];
  return items.filter((r) => r && typeof r.id === "string" && typeof r.description === "string");
}

export async function addRisk(leadId: string, item: Omit<RiskItem, "id" | "at">): Promise<void> {
  const full: RiskItem = {
    ...item,
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const all = await getAllRiskItems(leadId);
  await saveRiskLog(leadId, [...all, full]);
}

export async function resolveRisk(leadId: string, riskId: string): Promise<void> {
  const all = await getAllRiskItems(leadId);
  const items = all.map((r) =>
    r.id === riskId ? { ...r, resolvedAt: new Date().toISOString() } : r
  );
  await saveRiskLog(leadId, items);
}

async function saveRiskLog(leadId: string, items: RiskItem[]): Promise<void> {
  const content =
    "# Risk / Bottleneck Tracker\n\n" +
    items
      .map(
        (r) =>
          `- [${r.resolvedAt ? "x" : " "}] **${r.severity ?? "medium"}** ${r.description}${r.resolvedAt ? ` (resolved ${r.resolvedAt})` : ""}`
      )
      .join("\n");
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.RISK_BOTTLENECK_LOG },
    select: { id: true },
  });
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta: { items } },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPES.RISK_BOTTLENECK_LOG,
        title: "RISK_BOTTLENECK_LOG",
        content,
        meta: { items },
      },
    });
  }
}

export async function appendClientFeedback(
  leadId: string,
  entry: Omit<ClientFeedbackEntry, "id" | "at">
): Promise<void> {
  const full: ClientFeedbackEntry = {
    ...entry,
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const data = await getClientSuccessData(leadId);
  const entries = [...data.feedback, full];
  await saveFeedbackLog(leadId, entries);
}

async function saveFeedbackLog(leadId: string, entries: ClientFeedbackEntry[]): Promise<void> {
  const content =
    "# Client Feedback Check-ins\n\n" +
    entries
      .map(
        (e) =>
          `## ${e.at}\n${e.question ? `**Q:** ${e.question}\n` : ""}**A:** ${e.response}${e.themes?.length ? `\nThemes: ${e.themes.join(", ")}` : ""}`
      )
      .join("\n\n---\n\n");
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.CLIENT_FEEDBACK_LOG },
    select: { id: true },
  });
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta: { entries } },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPES.CLIENT_FEEDBACK_LOG,
        title: "CLIENT_FEEDBACK_LOG",
        content,
        meta: { entries },
      },
    });
  }
}

/** Upsert Results Ledger extra fields (current result, delta, what worked/failed, confidence, next action). */
export async function upsertResultsLedgerExtra(
  leadId: string,
  payload: Partial<ResultsLedgerExtra>
): Promise<void> {
  const data: ResultsLedgerExtra = {
    currentResult: payload.currentResult,
    delta: payload.delta,
    whatWorked: payload.whatWorked,
    whatFailed: payload.whatFailed,
    outcomeConfidence: payload.outcomeConfidence,
    nextActionRecommendation: payload.nextActionRecommendation,
  };
  const meta = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null));
  const content =
    "# Results Ledger\n\n" +
    (data.currentResult ? `**Current:** ${data.currentResult}\n` : "") +
    (data.delta ? `**Delta:** ${data.delta}\n` : "") +
    (data.whatWorked ? `**What worked:** ${data.whatWorked}\n` : "") +
    (data.whatFailed ? `**What didn't:** ${data.whatFailed}\n` : "") +
    (data.outcomeConfidence ? `**Confidence:** ${data.outcomeConfidence}\n` : "") +
    (data.nextActionRecommendation ? `**Next action:** ${data.nextActionRecommendation}\n` : "");
  const existing = await db.artifact.findFirst({
    where: { leadId, type: ARTIFACT_TYPES.RESULTS_LEDGER_EXTRA },
    select: { id: true },
  });
  if (existing) {
    await db.artifact.update({
      where: { id: existing.id },
      data: { content, meta },
    });
  } else {
    await db.artifact.create({
      data: {
        leadId,
        type: ARTIFACT_TYPES.RESULTS_LEDGER_EXTRA,
        title: "RESULTS_LEDGER_EXTRA",
        content: content || "Results ledger extension",
        meta,
      },
    });
  }
}

/** For proof generator: structured summary from baseline + interventions + outcome entries. */
export function buildProofSummaryFromSuccessData(data: ClientSuccessData): {
  resultTarget: string | null;
  baselineBullets: string[];
  interventionBullets: string[];
  outcomeBullets: string[];
} {
  const resultTarget =
    data.resultTarget
      ? `${data.resultTarget.currentState} → ${data.resultTarget.targetState} (${data.resultTarget.metric}, ${data.resultTarget.timeline})`
      : null;
  const baselineBullets =
    data.baseline?.metrics.map((m) => `${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ""}`) ?? [];
  const interventionBullets = data.interventions.map(
    (i) => `[${i.category}] ${i.description}${i.impact ? ` — ${i.impact}` : ""}`
  );
  const outcomeBullets: string[] = [];
  for (const e of data.outcomeEntries.slice(0, 4)) {
    for (const m of e.metrics) {
      outcomeBullets.push(`Week ${e.weekStart}: ${m.name} ${m.value}${m.unit ? ` ${m.unit}` : ""}${m.delta ? ` (${m.delta})` : ""}`);
    }
  }
  return { resultTarget, baselineBullets, interventionBullets, outcomeBullets };
}
