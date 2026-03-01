import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withRouteTiming } from "@/lib/api-utils";
import { runAiProspectSearch } from "@/lib/prospect/ai-search";

const BodySchema = z.object({
  query: z.string().min(1).max(1000),
});

export const maxDuration = 120;

/**
 * POST /api/prospect/ai
 * AI-powered prospect search: parses a natural language query,
 * searches across requested platforms via site-specific web search,
 * and suggests follow-up research angles.
 */
export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/prospect/ai", async () => {
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

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }

    try {
      const report = await runAiProspectSearch(parsed.data.query);
      return NextResponse.json(report);
    } catch (err) {
      console.error("[prospect/ai] Unhandled error:", err);
      return NextResponse.json({
        ok: false,
        parsed: { clientType: parsed.data.query, industry: undefined, keywords: [], platforms: ["google"], count: 10, location: undefined },
        results: [],
        brief: "",
        followUps: [],
        platformBreakdown: [],
        durationMs: 0,
        errors: [err instanceof Error ? err.message : "Search failed"],
      });
    }
  });
}
