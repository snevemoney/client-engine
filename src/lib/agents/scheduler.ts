/**
 * Agent Scheduler — determines which agents should run based on cron labels.
 * Labels: daily_morning (8am), daily_midday (12pm), weekly_monday (Mon 8am), every_6h.
 * Deduplication prevents double-runs within the same window.
 */
import { getAllAgentConfigs } from "./registry";
import { db } from "@/lib/db";
import type { AgentId, ScheduledRun } from "./types";

type ScheduledTask = {
  agentId: AgentId;
  cronLabel: string;
  taskPrompt: string;
  dedupeKey: string;
};

/** Build a dedupe key for a given agent + cron label + time window */
function buildDedupeKey(agentId: string, cronLabel: string, now: Date): string {
  const d = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const h = now.getUTCHours();

  if (cronLabel === "every_6h") {
    // Bucket into 6-hour windows: 0-5, 6-11, 12-17, 18-23
    const bucket = Math.floor(h / 6);
    return `${agentId}:${cronLabel}:${d}:b${bucket}`;
  }
  return `${agentId}:${cronLabel}:${d}`;
}

/** Check if a cron label should fire at the given UTC hour */
function shouldRunAtHour(cronLabel: string, hour: number, dayOfWeek: number): boolean {
  switch (cronLabel) {
    case "daily_morning":
      // 8am ET ≈ 13:00 UTC (EST) or 12:00 UTC (EDT)
      return hour >= 12 && hour <= 14;
    case "daily_midday":
      return hour >= 16 && hour <= 18;
    case "weekly_monday":
      return dayOfWeek === 1 && hour >= 12 && hour <= 14;
    case "every_6h":
      // Run in every 6-hour window: 0, 6, 12, 18
      return hour % 6 <= 1;
    default:
      return false;
  }
}

/**
 * Get all agent tasks that should run now.
 * Checks cron labels against current time and deduplicates
 * against existing AgentRun records.
 */
export async function getScheduledRuns(now: Date = new Date()): Promise<ScheduledTask[]> {
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday

  const allConfigs = getAllAgentConfigs();
  const candidates: ScheduledTask[] = [];

  for (const config of allConfigs) {
    for (const run of config.scheduledRuns) {
      if (!shouldRunAtHour(run.cronLabel, hour, dayOfWeek)) continue;

      const dedupeKey = buildDedupeKey(config.id, run.cronLabel, now);
      candidates.push({
        agentId: config.id,
        cronLabel: run.cronLabel,
        taskPrompt: run.taskPrompt,
        dedupeKey,
      });
    }
  }

  if (candidates.length === 0) return [];

  // Check which have already run
  const dedupeKeys = candidates.map((c) => c.dedupeKey);
  const existingRuns = await db.agentRun.findMany({
    where: { dedupeKey: { in: dedupeKeys } },
    select: { dedupeKey: true },
  });
  const alreadyRan = new Set(existingRuns.map((r) => r.dedupeKey));

  return candidates.filter((c) => !alreadyRan.has(c.dedupeKey));
}
