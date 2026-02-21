import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // DB connection
  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = { ok: true };
  } catch (e: unknown) {
    checks.db = { ok: false, detail: e instanceof Error ? e.message : "Connection failed" };
  }

  // Pipeline tables exist (PipelineRun, PipelineStepRun)
  try {
    await db.pipelineRun.findFirst({ take: 1 });
    checks.pipelineTables = { ok: true };
  } catch (e: unknown) {
    checks.pipelineTables = {
      ok: false,
      detail: e instanceof Error ? e.message : "PipelineRun/PipelineStepRun missing? Run prisma db push.",
    };
  }

  checks.authSecret = {
    ok: !!process.env.AUTH_SECRET,
    detail: process.env.AUTH_SECRET ? undefined : "AUTH_SECRET not set (NextAuth will fail)",
  };

  checks.nextAuthUrl = {
    ok: !!process.env.NEXTAUTH_URL,
    detail: process.env.NEXTAUTH_URL ? undefined : "NEXTAUTH_URL not set (redirect loops in production)",
  };

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
