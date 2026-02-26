import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth } from "@/lib/api-utils";
import { getRecentLearningArtifacts } from "@/lib/learning/ingest";
import { parseLimit } from "@/lib/query-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (!session) return jsonError("Unauthorized", 401);

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"), 20, 50);

  try {
    const data = await getRecentLearningArtifacts({ limit });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[learning GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load learning data" },
      { status: 500 }
    );
  }
}
