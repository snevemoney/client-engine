/**
 * GET /api/knowledge/search — Semantic search across knowledge base.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuth, withRouteTiming } from "@/lib/api-utils";
import { searchArtifacts } from "@/lib/pinecone";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteTiming("GET /api/knowledge/search", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q || q.length < 2) return jsonError("Query must be at least 2 characters", 400);

    const topK = Math.min(Math.max(parseInt(searchParams.get("topK") ?? "10", 10) || 10, 1), 30);
    const artifactType = searchParams.get("type") || undefined;

    const results = await searchArtifacts(q, { topK, artifactType });

    return NextResponse.json({ results, query: q });
  });
}
