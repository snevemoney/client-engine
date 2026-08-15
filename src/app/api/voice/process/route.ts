/**
 * POST /api/voice/process — Process eligible voice follow-ups (cron).
 * Auth: Bearer AGENT_CRON_SECRET or session.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withRouteTiming } from "@/lib/api-utils";
import { processVoiceFollowUps } from "@/lib/voice/process";

export const dynamic = "force-dynamic";

async function isAllowed(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.AGENT_CRON_SECRET;
  if (cronSecret && authHeader?.startsWith("Bearer ")) {
    if (authHeader.slice(7) === cronSecret) return true;
  }
  const session = await auth();
  return !!session?.user;
}

export async function POST(req: NextRequest) {
  return withRouteTiming("POST /api/voice/process", async () => {
    if (!(await isAllowed(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(String(body?.limit ?? 20), 10) || 20, 1), 50);

    const { processed, skipped, errors } = await processVoiceFollowUps(limit);

    return NextResponse.json({
      ok: errors.length === 0,
      processed,
      skipped,
      ...(errors.length ? { errors } : {}),
    });
  });
}
