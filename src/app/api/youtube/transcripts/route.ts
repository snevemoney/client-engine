import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTranscripts } from "@/lib/youtube/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 20;
  const status = url.searchParams.get("status") ?? undefined;
  const channelId = url.searchParams.get("channelId") ?? undefined;
  const provider = url.searchParams.get("provider") ?? undefined;

  try {
    const transcripts = await getTranscripts({ limit, status, channelId, provider });
    return NextResponse.json({ transcripts });
  } catch (e) {
    console.error("[youtube/transcripts]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load transcripts" },
      { status: 500 },
    );
  }
}
