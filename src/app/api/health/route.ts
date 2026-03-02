import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthCheck = { ok: boolean; detail?: string; data?: Record<string, unknown> };

export async function GET() {
  const checks: Record<string, HealthCheck> = {};

  // ── Core checks (required) ─────────────────────────────────────────

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

  // Redis (optional): when REDIS_URL set, verify worker/queue connectivity.
  // Skip in development when Redis points to localhost — avoids ioredis unhandled error flood when Redis isn't running.
  const isDevLocalRedis =
    process.env.NODE_ENV !== "production" &&
    process.env.REDIS_URL &&
    (process.env.REDIS_URL.includes("localhost") || process.env.REDIS_URL.includes("127.0.0.1"));
  if (process.env.REDIS_URL && !isDevLocalRedis) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis");
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: () => null, // Fail fast; no reconnect storm when Redis is down
      enableOfflineQueue: false,
    });
    redis.on("error", () => {}); // Must be before connect() to prevent unhandled error event
    try {
      await redis.connect();
      await redis.ping();
      checks.redis = { ok: true };
    } catch (e: unknown) {
      checks.redis = {
        ok: false,
        detail: e instanceof Error ? e.message : "Redis ping failed",
      };
    } finally {
      redis.disconnect();
    }
  }

  // ── System vitals (informational) ──────────────────────────────────

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Agent health
  try {
    const [running, failed24h, completed7d, total7d] = await Promise.all([
      db.agentRun.count({ where: { status: "running" } }),
      db.agentRun.count({ where: { status: "failed", startedAt: { gte: since24h } } }),
      db.agentRun.count({ where: { status: "completed", startedAt: { gte: since7d } } }),
      db.agentRun.count({ where: { startedAt: { gte: since7d } } }),
    ]);
    const successRate = total7d > 0 ? Math.round((completed7d / total7d) * 100) : null;
    checks.agents = {
      ok: failed24h < 5,
      data: { running, failed24h, successRate7d: successRate, total7d },
    };
  } catch { checks.agents = { ok: true, detail: "AgentRun table unavailable" }; }

  // NBA queue
  try {
    const [pending, oldestPending] = await Promise.all([
      db.nextBestAction.count({ where: { status: "queued" } }),
      db.nextBestAction.findFirst({
        where: { status: "queued" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);
    const oldestAgeHours = oldestPending
      ? Math.round((Date.now() - oldestPending.createdAt.getTime()) / (1000 * 60 * 60))
      : null;
    checks.nba = {
      ok: pending < 50,
      data: { pending, oldestAgeHours },
    };
  } catch { checks.nba = { ok: true, detail: "NextBestAction table unavailable" }; }

  // Risk flags
  try {
    const [openCritical, openHigh, openTotal] = await Promise.all([
      db.riskFlag.count({ where: { status: "open", severity: "critical" } }),
      db.riskFlag.count({ where: { status: "open", severity: "high" } }),
      db.riskFlag.count({ where: { status: "open" } }),
    ]);
    checks.risk = {
      ok: openCritical === 0,
      data: { openCritical, openHigh, openTotal },
    };
  } catch { checks.risk = { ok: true, detail: "RiskFlag table unavailable" }; }

  // Pipeline (24h)
  try {
    const [success24h, failed24hPipeline, total24h] = await Promise.all([
      db.pipelineRun.count({ where: { success: true, startedAt: { gte: since24h } } }),
      db.pipelineRun.count({ where: { success: false, startedAt: { gte: since24h } } }),
      db.pipelineRun.count({ where: { startedAt: { gte: since24h } } }),
    ]);
    checks.pipeline = {
      ok: total24h === 0 || failed24hPipeline / total24h < 0.5,
      data: { success24h, failed24h: failed24hPipeline, total24h },
    };
  } catch { checks.pipeline = { ok: true, detail: "PipelineRun query failed" }; }

  // Memory pipeline
  try {
    const [weights, recentEvents] = await Promise.all([
      db.operatorLearnedWeight.count(),
      db.operatorMemoryEvent.count({ where: { createdAt: { gte: since7d } } }),
    ]);
    checks.memory = {
      ok: true,
      data: { learnedWeights: weights, memoryEvents7d: recentEvents },
    };
  } catch { checks.memory = { ok: true, detail: "Memory tables unavailable" }; }

  // Flywheel runs
  try {
    const [completed, failed, total] = await Promise.all([
      db.flywheelRun.count({ where: { status: "completed", createdAt: { gte: since7d } } }),
      db.flywheelRun.count({ where: { status: "failed", createdAt: { gte: since7d } } }),
      db.flywheelRun.count({ where: { createdAt: { gte: since7d } } }),
    ]);
    checks.flywheel = {
      ok: total === 0 || failed / total < 0.5,
      data: { completed7d: completed, failed7d: failed, total7d: total },
    };
  } catch { checks.flywheel = { ok: true, detail: "FlywheelRun table unavailable" }; }

  // ── Result ─────────────────────────────────────────────────────────

  const required = ["db", "pipelineTables", "authSecret", "nextAuthUrl"];
  const ok = required.every((k) => checks[k]?.ok);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
