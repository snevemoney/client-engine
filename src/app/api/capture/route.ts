import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.CAPTURE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { url, title, content, source } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const hash = crypto.createHash("sha256").update(`${url || ""}:${title}`).digest("hex");

  const existing = await db.lead.findFirst({
    where: {
      OR: [{ sourceUrl: url || undefined }, { title }],
    },
  });

  if (existing) {
    return NextResponse.json({ message: "duplicate", leadId: existing.id }, { status: 200 });
  }

  const lead = await db.lead.create({
    data: {
      title,
      source: source || "capture",
      sourceUrl: url,
      description: content,
      tags: [],
      techStack: [],
    },
  });

  return NextResponse.json({ message: "created", leadId: lead.id }, { status: 201 });
}
