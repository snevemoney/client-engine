/**
 * Results Ledger: list of active/delivered clients with result target, baseline, current, delta, interventions, proof, next action.
 * Powers /dashboard/results (results-first view).
 */

import { db } from "@/lib/db";
import { getClientSuccessData } from "@/lib/client-success";

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
  proofCount: number; // outcome entries + baseline as proxy for "proof"
  whatWorked: string | null;
  whatFailed: string | null;
  outcomeConfidence: "observed" | "inferred" | "not_enough_data" | null;
  nextActionRecommendation: string | null;
};

export async function getResultsLedgerEntries(): Promise<ResultsLedgerEntry[]> {
  const leads = await db.lead.findMany({
    where: { status: { in: ["APPROVED", "BUILDING", "SHIPPED"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, status: true },
  });

  const entries: ResultsLedgerEntry[] = [];
  for (const lead of leads) {
    const data = await getClientSuccessData(lead.id);
    const resultTargetStr = data.resultTarget
      ? `${data.resultTarget.currentState} → ${data.resultTarget.targetState} (${data.resultTarget.metric})`
      : null;
    const baselineStr =
      data.baseline && data.baseline.metrics.length > 0
        ? data.baseline.metrics.map((m) => `${m.name}: ${m.value}`).join(", ")
        : null;
    entries.push({
      leadId: lead.id,
      title: lead.title,
      status: lead.status,
      resultTarget: resultTargetStr,
      baselineSummary: baselineStr,
      currentResult: data.resultsLedgerExtra?.currentResult ?? null,
      delta: data.resultsLedgerExtra?.delta ?? null,
      interventionsCount: data.interventions.length,
      outcomeEntriesCount: data.outcomeEntries.length,
      proofCount: data.outcomeEntries.length + (data.baseline?.metrics?.length ? 1 : 0),
      whatWorked: data.resultsLedgerExtra?.whatWorked ?? null,
      whatFailed: data.resultsLedgerExtra?.whatFailed ?? null,
      outcomeConfidence: data.resultsLedgerExtra?.outcomeConfidence ?? null,
      nextActionRecommendation: data.resultsLedgerExtra?.nextActionRecommendation ?? null,
    });
  }
  return entries;
}
