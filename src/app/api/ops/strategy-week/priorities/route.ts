/**
 * POST /api/ops/strategy-week/priorities — Add a priority for current week
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWeekStart } from "@/lib/ops/strategyWeek";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "done", "blocked"]).optional(),
});

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/ops/strategy-week/priorities", async () => {
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

    const weekStart = getWeekStart();
    const week = await db.strategyWeek.upsert({
      where: { weekStart },
      create: { weekStart },
      update: {},
    });

    const priority = await db.strategyWeekPriority.create({
      data: {
        strategyWeekId: week.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: parsed.data.status ?? "todo",
      },
    });

    revalidatePath("/dashboard/command");
    return NextResponse.json(priority);
  });
}
