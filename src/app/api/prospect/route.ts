/**
 * POST /api/prospect — Run prospect research across all enabled integrations.
 * Body: { clientType, industry?, keywords?, budgetMin?, budgetMax?, location? }
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { jsonError, withRouteTiming } from "@/lib/api-utils";
import { runProspectSearch } from "@/lib/prospect";
import type { ProspectCriteria } from "@/lib/prospect";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  return withRouteTiming("POST /api/prospect", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const body = (await req.json()) as Partial<ProspectCriteria>;
    if (!body.clientType?.trim()) {
      return jsonError("clientType is required", 400);
    }

    const criteria: ProspectCriteria = {
      clientType: body.clientType.trim(),
      industry: body.industry?.trim() || undefined,
      keywords: body.keywords?.filter((k) => k.trim()) ?? [],
      budgetMin: body.budgetMin,
      budgetMax: body.budgetMax,
      location: body.location?.trim() || undefined,
    };

    const report = await runProspectSearch(criteria);

    return NextResponse.json(report);
  });
}
