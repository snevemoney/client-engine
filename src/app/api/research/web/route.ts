import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runWebResearch } from "@/lib/web-research";
import { WebResearchRequestSchema } from "@/lib/web-research/types";
import { withRouteTiming } from "@/lib/api-utils";

/**
 * POST /api/research/web
 * Run web research on a lead (stores artifact) or standalone query (returns brief).
 * Auth: session only (dashboard-triggered, not cron).
 */
export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/research/web", async () => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = WebResearchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }

    const result = await runWebResearch(parsed.data);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  });
}
