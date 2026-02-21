import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPendingKnowledgeUrls, addPendingKnowledgeUrl } from "@/lib/knowledge/ingest";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const pending = await getPendingKnowledgeUrls(20);
    return NextResponse.json({ pending });
  } catch (e) {
    console.error("[knowledge/queue GET]", e);
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { url?: string; type?: "video" | "channel"; maxVideos?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body with url and type required" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const type = body.type === "channel" ? "channel" : "video";
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  try {
    await addPendingKnowledgeUrl(url, type, type === "channel" ? body.maxVideos : undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[knowledge/queue POST]", e);
    return NextResponse.json({ error: "Failed to add to queue" }, { status: 500 });
  }
}
