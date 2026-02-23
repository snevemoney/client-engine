import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getResultsLedgerEntries } from "@/lib/ops/resultsLedger";

export const dynamic = "force-dynamic";

/** GET /api/results-ledger — List active/delivered clients with result summary for Results Ledger view. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const entries = await getResultsLedgerEntries();
    return NextResponse.json(entries);
  } catch (e) {
    console.error("[results-ledger GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load results ledger" },
      { status: 500 }
    );
  }
}
