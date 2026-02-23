import { getResultsLedgerEntries } from "@/lib/ops/resultsLedger";
import { ResultsLedgerClient } from "@/components/dashboard/results/ResultsLedgerClient";

export const dynamic = "force-dynamic";

export default async function ResultsLedgerPage() {
  const entries = await getResultsLedgerEntries();

  return <ResultsLedgerClient entries={entries} />;
}
