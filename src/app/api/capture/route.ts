import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

function computeHash(url: string | undefined, title: string, content: string | undefined): string {
  const raw = [url || "", title, (content || "").slice(0, 500)].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.CAPTURE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, title, content, source, budget, timeline, platform, tags, contactName, contactEmail } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const hash = computeHash(
      typeof url === "string" ? url : undefined,
      title,
      typeof content === "string" ? content : undefined
    );

      const existing = await db.lead.findFirst({
      where: {
        OR: [
          { contentHash: hash },
          ...(typeof url === "string" && url ? [{ sourceUrl: url }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ message: "duplicate", leadId: existing.id }, { status: 200 });
    }

    const lead = await db.lead.create({
      data: {
        title,
        source: typeof source === "string" ? source : "capture",
        sourceUrl: typeof url === "string" ? url : null,
        contentHash: hash,
        description: typeof content === "string" ? content : null,
        budget: typeof budget === "string" ? budget : null,
        timeline: typeof timeline === "string" ? timeline : null,
        platform: typeof platform === "string" ? platform : null,
        contactName: typeof contactName === "string" ? contactName : null,
        contactEmail: typeof contactEmail === "string" ? contactEmail : null,
        tags: Array.isArray(tags) ? tags : [],
        techStack: [],
      },
    });

    return NextResponse.json({ message: "created", leadId: lead.id }, { status: 201 });
  } catch (e) {
    console.error("[capture POST]", e);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
