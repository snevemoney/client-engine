/**
 * Results Ledger: list of active/delivered clients with result target, baseline, current, delta, interventions, proof, next action.
 * Powers /dashboard/results (results-first view).
 */

import { db } from "@/lib/db";
import { ARTIFACT_TYPES } from "@/lib/client-success/types";
import type {
  ResultTarget,
  BaselineSnapshot,
  InterventionEntry,
  OutcomeEntry,
  ResultsLedgerExtra,
} from "@/lib/client-success/types";

export type ResultsLedgerEntry = {
  leadId: string;
  title: string;
  status: string;
  resultTarget: string | null;
  baselineSummary: string | null;
  currentResult: string | null;
  delta: string | null;
  interventionsCount: number;
  outcomeEntriesCount: number;
  proofCount: number;
  whatWorked: string | null;
  whatFailed: string | null;
  outcomeConfidence: "observed" | "inferred" | "not_enough_data" | null;
  nextActionRecommendation: string | null;
};

export async function getResultsLedgerEntries(): Promise<ResultsLedgerEntry[]> {
  const leads = await db.lead.findMany({
    where: { status: { in: ["APPROVED", "BUILDING", "SHIPPED"] } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, status: true },
  });

  if (leads.length === 0) return [];

  const leadIds = leads.map((l) => l.id);
  const relevantTypes = [
    ARTIFACT_TYPES.RESULT_TARGET,
    ARTIFACT_TYPES.BASELINE_SNAPSHOT,
    ARTIFACT_TYPES.INTERVENTION_LOG,
    ARTIFACT_TYPES.OUTCOME_SCORECARD,
    ARTIFACT_TYPES.RESULTS_LEDGER_EXTRA,
  ];

  const allArtifacts = await db.artifact.findMany({
    where: { leadId: { in: leadIds }, type: { in: relevantTypes } },
    orderBy: { createdAt: "asc" },
    select: { leadId: true, type: true, meta: true },
  });

  const artifactsByLead = new Map<string, typeof allArtifacts>();
  for (const a of allArtifacts) {
    const list = artifactsByLead.get(a.leadId) ?? [];
    list.push(a);
    artifactsByLead.set(a.leadId, list);
  }

  return leads.map((lead) => {
    const arts = artifactsByLead.get(lead.id) ?? [];

    let resultTarget: ResultTarget | null = null;
    let baseline: BaselineSnapshot | null = null;
    let interventions: InterventionEntry[] = [];
    let outcomeEntries: OutcomeEntry[] = [];
    let ledgerExtra: ResultsLedgerExtra | null = null;

    for (const a of arts) {
      const m = a.meta as Record<string, unknown> | null;
      if (!m) continue;

      if (a.type === ARTIFACT_TYPES.RESULT_TARGET && m.currentState && m.targetState && m.metric && m.timeline) {
        resultTarget = { currentState: String(m.currentState), targetState: String(m.targetState), metric: String(m.metric), timeline: String(m.timeline), capturedAt: String(m.capturedAt ?? "") };
      } else if (a.type === ARTIFACT_TYPES.BASELINE_SNAPSHOT && Array.isArray(m.metrics)) {
        baseline = { metrics: (m.metrics as { name: string; value: string; unit?: string }[]).map((x) => ({ name: String(x?.name ?? ""), value: String(x?.value ?? ""), unit: x?.unit != null ? String(x.unit) : undefined })), capturedAt: String(m.capturedAt ?? "") };
      } else if (a.type === ARTIFACT_TYPES.INTERVENTION_LOG && Array.isArray((m as { entries?: unknown[] }).entries)) {
        interventions = ((m as { entries: InterventionEntry[] }).entries).filter((e) => e && typeof e.id === "string");
      } else if (a.type === ARTIFACT_TYPES.OUTCOME_SCORECARD && Array.isArray((m as { entries?: unknown[] }).entries)) {
        outcomeEntries = ((m as { entries: OutcomeEntry[] }).entries).filter((e) => e && typeof e.id === "string");
      } else if (a.type === ARTIFACT_TYPES.RESULTS_LEDGER_EXTRA) {
        ledgerExtra = {
          currentResult: m.currentResult != null ? String(m.currentResult) : undefined,
          delta: m.delta != null ? String(m.delta) : undefined,
          whatWorked: m.whatWorked != null ? String(m.whatWorked) : undefined,
          whatFailed: m.whatFailed != null ? String(m.whatFailed) : undefined,
          outcomeConfidence: ["observed", "inferred", "not_enough_data"].includes(String(m.outcomeConfidence)) ? (m.outcomeConfidence as ResultsLedgerExtra["outcomeConfidence"]) : undefined,
          nextActionRecommendation: ["upsell", "optimize", "closeout", "case_study", "follow_up", "none"].includes(String(m.nextActionRecommendation)) ? (m.nextActionRecommendation as ResultsLedgerExtra["nextActionRecommendation"]) : undefined,
        };
      }
    }

    const resultTargetStr = resultTarget ? `${resultTarget.currentState} → ${resultTarget.targetState} (${resultTarget.metric})` : null;
    const baselineStr = baseline && baseline.metrics.length > 0 ? baseline.metrics.map((m) => `${m.name}: ${m.value}`).join(", ") : null;

    return {
      leadId: lead.id,
      title: lead.title,
      status: lead.status,
      resultTarget: resultTargetStr,
      baselineSummary: baselineStr,
      currentResult: ledgerExtra?.currentResult ?? null,
      delta: ledgerExtra?.delta ?? null,
      interventionsCount: interventions.length,
      outcomeEntriesCount: outcomeEntries.length,
      proofCount: outcomeEntries.length + (baseline?.metrics?.length ? 1 : 0),
      whatWorked: ledgerExtra?.whatWorked ?? null,
      whatFailed: ledgerExtra?.whatFailed ?? null,
      outcomeConfidence: ledgerExtra?.outcomeConfidence ?? null,
      nextActionRecommendation: ledgerExtra?.nextActionRecommendation ?? null,
    };
  });
}
