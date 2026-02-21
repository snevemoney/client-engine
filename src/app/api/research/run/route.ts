import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runResearchDiscoverAndPipeline } from "@/lib/research/run";

/**
 * POST /api/research/run
 * Run one research cycle (discover → dedupe → create leads + RESEARCH_SNAPSHOT → trigger pipeline).
 * Auth: session (dashboard) or Bearer RESEARCH_CRON_SECRET (cron on VPS).
 * Query: limit (optional, max leads to create this run).
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.RESEARCH_CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const bearerMatch = cronSecret && authHeader?.startsWith("Bearer ") && authHeader.slice(7) === cronSecret;

  if (!bearerMatch) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 50) : undefined;

  try {
    const report = await runResearchDiscoverAndPipeline({ limit });
    return NextResponse.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[research/run] Error:", err);
    return NextResponse.json(
      { ok: false, error: message, at: new Date().toISOString() },
      { status: 500 }
    );
  }
}
