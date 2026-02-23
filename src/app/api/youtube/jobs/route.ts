import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecentJobs } from "@/lib/youtube/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 20;
  const status = url.searchParams.get("status") ?? undefined;

  try {
    const jobs = await getRecentJobs({ limit, status });
    return NextResponse.json({ jobs });
  } catch (e) {
    console.error("[youtube/jobs]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load jobs" },
      { status: 500 },
    );
  }
}
