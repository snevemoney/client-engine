import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ingestChannel } from "@/lib/youtube/channelIngest";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required with url" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const limit = typeof body.limit === "number" ? body.limit : undefined;

  try {
    const result = await ingestChannel(url, limit);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e) {
    console.error("[youtube/ingest/channel]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Channel ingest failed" },
      { status: 500 },
    );
  }
}
