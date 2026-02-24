import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withRouteTiming } from "@/lib/api-utils";

/** GET /api/proof-records */
export async function GET() {
  return withRouteTiming("GET /api/proof-records", async () => {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const records = await db.proofRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      records.map((r) => ({
        id: r.id,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        intakeLeadId: r.intakeLeadId ?? null,
        proofCandidateId: r.proofCandidateId ?? null,
        title: r.title ?? "",
        company: r.company ?? null,
        outcome: r.outcome ?? "won",
        proofSnippet: r.proofSnippet ?? null,
        beforeState: r.beforeState ?? null,
        afterState: r.afterState ?? null,
        metricValue: r.metricValue ?? null,
        metricLabel: r.metricLabel ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  });
}
