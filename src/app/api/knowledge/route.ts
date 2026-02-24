import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecentKnowledgeArtifacts } from "@/lib/knowledge/ingest";
import { withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withRouteTiming("GET /api/knowledge", async () => {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 50) : 20;

    try {
      const data = await getRecentKnowledgeArtifacts({ limit });
      return NextResponse.json(data);
    } catch (e) {
      console.error("[knowledge GET]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to load knowledge data" },
        { status: 500 }
      );
    }
  });
}
