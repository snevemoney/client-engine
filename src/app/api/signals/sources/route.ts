/**
 * GET /api/signals/sources — List all signal sources
 * POST /api/signals/sources — Create a new source
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  type: z.enum(["rss", "atom"]).optional().default("rss"),
  enabled: z.boolean().optional().default(true),
  mode: z.enum(["off", "mock", "manual", "live"]).optional().default("mock"),
  prodOnly: z.boolean().optional().default(false),
});

export async function GET() {
  return withRouteTiming("GET /api/signals/sources", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const sources = await db.signalSource.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { items: true } } },
    });

    return NextResponse.json({
      items: sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        url: s.url,
        enabled: s.enabled,
        mode: s.mode,
        prodOnly: s.prodOnly,
        lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
        itemCount: s._count.items,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/signals/sources", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const source = await db.signalSource.create({
      data: {
        name: parsed.data.name,
        url: parsed.data.url,
        type: parsed.data.type,
        enabled: parsed.data.enabled,
        mode: parsed.data.mode as "off" | "mock" | "manual" | "live",
        prodOnly: parsed.data.prodOnly,
      },
    });

    return NextResponse.json(source);
  });
}
