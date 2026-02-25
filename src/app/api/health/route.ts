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

  // Redis (optional): when REDIS_URL set, verify worker/queue connectivity
  if (process.env.REDIS_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require("ioredis");
      const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
      await redis.ping();
      redis.disconnect();
      checks.redis = { ok: true };
    } catch (e: unknown) {
      checks.redis = {
        ok: false,
        detail: e instanceof Error ? e.message : "Redis ping failed",
      };
    }
  }

  const required = ["db", "pipelineTables", "authSecret", "nextAuthUrl"];
  const ok = required.every((k) => checks[k]?.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
