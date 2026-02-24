/**
 * GET /api/ops/planning-themes — List planning themes (year, quarter, month)
 * POST /api/ops/planning-themes — Upsert a theme
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  periodType: z.enum(["year", "quarter", "month"]),
  periodKey: z.string().min(1),
  theme: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  return withRouteTiming("GET /api/ops/planning-themes", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const themes = await db.planningTheme.findMany({
      orderBy: [{ periodType: "asc" }, { periodKey: "desc" }],
    });
    return NextResponse.json(themes);
  });
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/ops/planning-themes", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { periodType, periodKey, theme, notes } = parsed.data;
    const record = await db.planningTheme.upsert({
      where: { periodType_periodKey: { periodType, periodKey } },
      create: { periodType, periodKey, theme, notes: notes ?? undefined },
      update: { theme, notes: notes ?? undefined },
    });
    return NextResponse.json(record);
  });
}
