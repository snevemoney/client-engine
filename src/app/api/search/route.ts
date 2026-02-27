import { NextRequest, NextResponse } from "next/server";
import { withRouteTiming, requireAuth, jsonError } from "@/lib/api-utils";
import { searchArtifacts } from "@/lib/pinecone";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/search", async () => {
    const session = await requireAuth();
    if (!session) return jsonError("Unauthorized", 401);

    const query = req.nextUrl.searchParams.get("q");
    if (!query?.trim()) return jsonError("q parameter required", 400);

    const rawLimit = parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10);
    const topK = Math.min(Number.isNaN(rawLimit) ? 10 : rawLimit, 20);
    const leadId = req.nextUrl.searchParams.get("leadId") ?? undefined;
    const artifactType = req.nextUrl.searchParams.get("type") ?? undefined;

    const results = await searchArtifacts(query, { topK, leadId, artifactType });
    return NextResponse.json({ results });
  });
}
