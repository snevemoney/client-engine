/**
 * Voice Phase 4: Process eligible voice follow-ups.
 * Fetches eligible, respects calling window (9–18 local), rate limit 10/day.
 * Stubs schedule (no actual Retell/Vapi call without API key).
 */
import { db } from "@/lib/db";
import { getEligibleProposals } from "./eligible";
import { checkConsent } from "./consent";
import { logOpsEventSafe } from "@/lib/ops-events/log";

const CALLING_WINDOW_START = 9;
const CALLING_WINDOW_END = 18;
const RATE_LIMIT_PER_DAY = 10;

export type ProcessVoiceResult = {
  processed: number;
  skipped: number;
  errors: string[];
};

function getStartOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function isWithinCallingWindow(now: Date): boolean {
  const hour = now.getHours();
  return hour >= CALLING_WINDOW_START && hour < CALLING_WINDOW_END;
}

async function getVoiceScheduleCountToday(): Promise<number> {
  const now = new Date();
  const startOfDay = getStartOfDay(now);
  const activities = await db.proposalActivity.findMany({
    where: {
      type: "followup_scheduled",
      createdAt: { gte: startOfDay },
    },
    select: { metaJson: true },
  });
  return activities.filter((a) => {
    const meta = a.metaJson as Record<string, unknown> | null;
    return meta?.source === "voice";
  }).length;
}

/**
 * Process eligible voice follow-ups. Respects calling window and rate limit.
 * For each eligible proposal: calls schedule (stub — logs intent via ProposalActivity).
 */
export async function processVoiceFollowUps(limit = 20): Promise<ProcessVoiceResult> {
  const now = new Date();
  const errors: string[] = [];
  let processed = 0;

  if (!isWithinCallingWindow(now)) {
    return { processed: 0, skipped: 0, errors: ["Outside calling window (9–18 local)"] };
  }

  const scheduledToday = await getVoiceScheduleCountToday();
  if (scheduledToday >= RATE_LIMIT_PER_DAY) {
    return {
      processed: 0,
      skipped: 0,
      errors: [`Rate limit reached (${RATE_LIMIT_PER_DAY}/day)`],
    };
  }

  const eligible = await getEligibleProposals(limit);
  const remaining = Math.min(limit, RATE_LIMIT_PER_DAY - scheduledToday);

  for (const p of eligible) {
    if (processed >= remaining) break;

    try {
      const hasConsent = await checkConsent(p.id);
      if (!hasConsent) continue;

      const hasApiKey = !!(process.env.VAPI_API_KEY || process.env.RETELL_API_KEY);
      await db.proposalActivity.create({
        data: {
          proposalId: p.id,
          type: "followup_scheduled",
          message: hasApiKey ? "Voice follow-up scheduled (cron)" : "Voice follow-up scheduled (stub — no API key)",
          metaJson: { source: "voice", stub: !hasApiKey, cron: true },
        },
      });
      logOpsEventSafe({
        category: "voice",
        eventKey: "voice.process_scheduled",
        status: "success",
        sourceType: "proposal",
        sourceId: p.id,
      });
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${p.id}: ${msg}`);
    }
  }

  return { processed, skipped: eligible.length - processed, errors };
}

