/**
 * POST /api/cadence/process
 * Process due cadences: send operator alerts, mark completed.
 * Auth: Bearer AGENT_CRON_SECRET or session (for manual trigger).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processDueCadences } from "@/lib/cadence/process";
import { withRouteTiming } from "@/lib/api-utils";

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
  return withRouteTiming("POST /api/cadence/process", async () => {
    if (!(await isAllowed(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(String(body?.limit ?? 50), 10) || 50, 1), 100);

    const { processed, errors } = await processDueCadences(limit);

    return NextResponse.json({
      ok: errors.length === 0,
      processed,
      ...(errors.length ? { errors } : {}),
    });
  });
}
