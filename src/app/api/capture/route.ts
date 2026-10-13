import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import crypto from "crypto";
import { checkStateChangeRateLimit } from "@/lib/api-utils";
import { notifyNewLead } from "@/lib/notify";
import { timingSafeEqualString } from "@/lib/crypto/hmac";

function computeHash(url: string | undefined, title: string, content: string | undefined): string {
  const raw = [url || "", title, (content || "").slice(0, 500)].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

const captureSchema = z.object({
  title: z.string().min(1),
  url: z.string().max(2000).optional(),
  content: z.string().max(20_000).optional(),
  source: z.string().max(200).optional(),
  budget: z.string().max(200).optional(),
  timeline: z.string().max(200).optional(),
  platform: z.string().max(200).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.union([z.string().email().max(255), z.literal("")]).optional(),
});

export async function POST(req: NextRequest) {
  const rateErr = checkStateChangeRateLimit(req, "capture", null, { windowMs: 60_000, max: 30 });
  if (rateErr) return rateErr;

  const apiKey = req.headers.get("x-api-key");
  const expected = process.env.CAPTURE_API_KEY;
  if (!expected || !apiKey || !timingSafeEqualString(apiKey, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = captureSchema.safeParse(json);
  if (!parsed.success) {
    const titleIssue = parsed.error.issues.find((i) => i.path[0] === "title");
    if (titleIssue) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { url, title, content, source, budget, timeline, platform, tags, contactName, contactEmail } = parsed.data;

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

    const rawDescription = typeof content === "string" ? content : null;
    const description = rawDescription != null ? rawDescription.slice(0, 3000) : null;

    const lead = await db.lead.create({
      data: {
        title,
        source: typeof source === "string" ? source : "capture",
        sourceUrl: typeof url === "string" ? url : null,
        contentHash: hash,
        description,
        budget: typeof budget === "string" ? budget : null,
        timeline: typeof timeline === "string" ? timeline : null,
        platform: typeof platform === "string" ? platform : null,
        contactName: typeof contactName === "string" ? contactName : null,
        contactEmail: typeof contactEmail === "string" ? contactEmail : null,
        tags: Array.isArray(tags) ? tags : [],
        techStack: [],
      },
    });

    notifyNewLead(lead.id, lead.title, lead.source);

    return NextResponse.json({ message: "created", leadId: lead.id }, { status: 201 });
  } catch (e) {
    console.error("[capture POST]", e);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
