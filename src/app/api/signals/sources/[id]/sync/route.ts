/**
 * POST /api/signals/sources/[id]/sync — Trigger sync for a signal source
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncRssSource } from "@/lib/signals/rss-sync";
import { jsonError, withRouteTiming } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRouteTiming("POST /api/signals/sources/[id]/sync", async () => {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;

    const source = await db.signalSource.findUnique({ where: { id } });
    if (!source) return jsonError("Source not found", 404);

    const isProduction = process.env.NODE_ENV === "production";

    const result = await syncRssSource(source.id, source.mode, isProduction);

    return NextResponse.json({
      ok: result.ok,
      count: result.count,
      message: result.message,
    });
  });
}
