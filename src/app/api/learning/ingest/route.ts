import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ingestVideo, ingestChannel } from "@/lib/learning/ingest";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { videoUrl?: string; channelUrl?: string; maxVideos?: number; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON body required with videoUrl or channelUrl" },
      { status: 400 }
    );
  }

  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : undefined;

  if (body.channelUrl) {
    const channelUrl = typeof body.channelUrl === "string" ? body.channelUrl.trim() : "";
    if (!channelUrl) {
      return NextResponse.json({ error: "channelUrl is required when provided" }, { status: 400 });
    }
    const maxVideos = typeof body.maxVideos === "number" ? Math.min(Math.max(1, body.maxVideos), 50) : 10;
    try {
      const report = await ingestChannel({ channelUrl, maxVideos, tags });
      return NextResponse.json(report);
    } catch (e) {
      console.error("[learning/ingest channel]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Channel ingest failed" },
        { status: 500 }
      );
    }
  }

  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  if (!videoUrl) {
    return NextResponse.json(
      { error: "videoUrl or channelUrl is required" },
      { status: 400 }
    );
  }

  try {
    const report = await ingestVideo({ videoUrl, tags });
    return NextResponse.json(report);
  } catch (e) {
    console.error("[learning/ingest]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
