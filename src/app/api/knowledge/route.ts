import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecentKnowledgeArtifacts } from "@/lib/knowledge/ingest";
import { parseLimit } from "@/lib/query-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"), 20, 50);

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
}
