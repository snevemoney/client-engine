import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ingestVideo } from "@/lib/youtube/videoIngest";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required with url" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const result = await ingestVideo(url);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e) {
    console.error("[youtube/ingest/video]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Video ingest failed" },
      { status: 500 },
    );
  }
}
