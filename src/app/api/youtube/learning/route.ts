import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLearningProposals } from "@/lib/youtube/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 20;
  const status = url.searchParams.get("status") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const systemArea = url.searchParams.get("systemArea") ?? undefined;

  try {
    const proposals = await getLearningProposals({ limit, status, category, systemArea });
    return NextResponse.json({ proposals });
  } catch (e) {
    console.error("[youtube/learning]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load proposals" },
      { status: 500 },
    );
  }
}
