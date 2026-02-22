/**
 * Content assets: list and create. For Phase C content-to-revenue attribution.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  platform: z.string().min(1).max(100),
  title: z.string().optional(),
  url: z.string().optional(),
  topicTag: z.string().optional(),
  format: z.string().optional(),
  ctaType: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assets = await db.contentAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(assets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const asset = await db.contentAsset.create({
    data: {
      platform: parsed.data.platform,
      title: parsed.data.title ?? null,
      url: parsed.data.url ?? null,
      topicTag: parsed.data.topicTag ?? null,
      format: parsed.data.format ?? null,
      ctaType: parsed.data.ctaType ?? null,
      notes: parsed.data.notes ?? null,
    },
  });
  return NextResponse.json(asset);
}
