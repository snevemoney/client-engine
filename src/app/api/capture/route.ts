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

  const body = await req.json();
  const { url, title, content, source, budget, timeline, platform, tags, contactName, contactEmail } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const hash = computeHash(url, title, content);

  const existing = await db.lead.findFirst({
    where: {
      OR: [
        { contentHash: hash },
        ...(url ? [{ sourceUrl: url }] : []),
      ],
    },
  });

  if (existing) {
    return NextResponse.json({ message: "duplicate", leadId: existing.id }, { status: 200 });
  }

  const lead = await db.lead.create({
    data: {
      title,
      source: source || "capture",
      sourceUrl: url || null,
      contentHash: hash,
      description: content || null,
      budget: budget || null,
      timeline: timeline || null,
      platform: platform || null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      tags: Array.isArray(tags) ? tags : [],
      techStack: [],
    },
  });

  return NextResponse.json({ message: "created", leadId: lead.id }, { status: 201 });
}
