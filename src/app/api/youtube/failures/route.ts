import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUnifiedFailures } from "@/lib/youtube/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 30;

  try {
    const failures = await getUnifiedFailures(limit);
    return NextResponse.json({
      failures: failures.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[youtube/failures]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load failures" },
      { status: 500 },
    );
  }
}
