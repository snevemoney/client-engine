import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getResultsLedgerEntries } from "@/lib/ops/resultsLedger";
import { ResultsLedgerClient } from "@/components/dashboard/results/ResultsLedgerClient";

export const dynamic = "force-dynamic";

export default async function ResultsLedgerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const entries = await getResultsLedgerEntries();

  return <ResultsLedgerClient entries={entries} />;
}
