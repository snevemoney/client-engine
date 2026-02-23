/**
 * Meta Ads V3.2/V3.3 Scheduler — one cycle execution.
 * Reuses apply-recommendation and generate-recommendations. Respects all guardrails.
 * V3.3: alerts, trend-aware generation, summary includes alertsSent/trendDataAvailable.
 */
import { db } from "@/lib/db";
import { runGenerateRecommendations } from "@/lib/meta-ads/generate-recommendations";
import { applyRecommendation } from "@/lib/meta-ads/apply-recommendation";
import { sendMetaAdsAlert } from "@/lib/meta-ads/alerts";

const EXECUTABLE_ACTIONS = ["pause", "resume", "increase_budget", "decrease_budget"];

export type SchedulerTrigger = "manual" | "scheduled";

export type SchedulerRunResult = {
  status: "success" | "partial" | "failed" | "skipped";
  summary: {
    generated: number;
    autoApproved: number;
    applied: number;
    simulated: number;
    blocked: number;
    failed: number;
    skipped: number;
    error?: string;
    criticalRecommendationsGenerated?: number;
    trendDataAvailable?: boolean;
    alertsSent?: number;
  };
  runLogId?: string;
};

/**
 * Run one scheduler cycle.
 * 1. Load settings → exit if schedulerEnabled false
 * 2. Optionally generate recommendations
 * 3. Optionally auto-approve low-risk (if enabled)
 * 4. Apply approved recs (max maxAppliesPerRun)
 * 5. Record run log + update last run on settings
 */
export async function runSchedulerCycle(
  accountId: string,
  trigger: SchedulerTrigger = "manual"
): Promise<SchedulerRunResult> {
  const acc = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  const settings = await db.metaAdsAutomationSettings.findUnique({
    where: { accountId: acc },
  });

  if (!settings?.schedulerEnabled) {
    const runLog = await db.metaAdsSchedulerRunLog.create({
      data: {
        accountId: acc,
        finishedAt: new Date(),
        status: "skipped",
        trigger,
        dryRun: settings?.dryRun ?? true,
        summary: { reason: "scheduler_disabled" },
      },
    });
    return {
      status: "skipped",
      summary: { generated: 0, autoApproved: 0, applied: 0, simulated: 0, blocked: 0, failed: 0, skipped: 0 },
      runLogId: runLog.id,
    };
  }

  const dryRun = settings.dryRun ?? true;
  const runLog = await db.metaAdsSchedulerRunLog.create({
    data: {
      accountId: acc,
      trigger,
      dryRun,
      status: "success",
      summary: {},
    },
  });

  let generated = 0;
  let autoApproved = 0;
  let applied = 0;
  let simulated = 0;
  let blocked = 0;
  let failed = 0;
  let skipped = 0;
  let topError: string | undefined;
  let criticalRecommendationsGenerated = 0;
  let trendDataAvailable = false;
  let alertsSent = 0;

  try {
    if (settings.autoGenerateRecommendations) {
      const genResult = await runGenerateRecommendations(acc);
      if (genResult.ok) {
        generated = genResult.generated;
        criticalRecommendationsGenerated = genResult.criticalCount ?? 0;
        trendDataAvailable = genResult.trendDataAvailable ?? false;
        if (criticalRecommendationsGenerated > 0) {
          const criticalRecs = await db.metaAdsRecommendation.findMany({
            where: { accountId: acc, status: "queued", severity: "critical" },
            select: { id: true, entityType: true, entityId: true, entityName: true, ruleKey: true, evidence: true },
          });
          for (const r of criticalRecs.slice(0, 5)) {
            const sent = await sendMetaAdsAlert({
              eventType: "critical_recommendation",
              severity: "critical",
              accountId: acc,
              entityType: r.entityType,
              entityId: r.entityId,
              entityName: r.entityName ?? undefined,
              ruleKey: r.ruleKey ?? undefined,
              evidence: (r.evidence as Record<string, unknown>) ?? undefined,
              message: `New critical recommendation: ${r.ruleKey ?? "unknown"}`,
            });
            if (sent) alertsSent++;
          }
        }
      } else {
        await sendMetaAdsAlert({
          eventType: "scheduler_failure",
          severity: "critical",
          accountId: acc,
          message: `In Generate: ${genResult.error}`,
        });
        await db.metaAdsSchedulerRunLog.update({
          where: { id: runLog.id },
          data: {
            finishedAt: new Date(),
            status: "failed",
            error: genResult.error,
            summary: { generated: 0, error: genResult.error },
          },
        });
        return {
          status: "failed",
          summary: { generated: 0, autoApproved: 0, applied: 0, simulated: 0, blocked: 0, failed: 0, skipped: 0, error: genResult.error },
          runLogId: runLog.id,
        };
      }
    }

    const allowedAutoApproveRuleKeys = (settings.allowedAutoApproveRuleKeys as string[]) ?? [];
    const canAutoApprove = settings.autoApproveLowRisk && allowedAutoApproveRuleKeys.length > 0;

    if (canAutoApprove) {
      const toApprove = await db.metaAdsRecommendation.findMany({
        where: {
          accountId: acc,
          status: "queued",
          ruleKey: { in: allowedAutoApproveRuleKeys },
          severity: { not: "critical" },
          actionType: { in: EXECUTABLE_ACTIONS },
        },
        select: { id: true },
      });
      for (const r of toApprove) {
        await db.metaAdsRecommendation.update({
          where: { id: r.id },
          data: { status: "approved", approvedAt: new Date(), updatedAt: new Date() },
        });
        autoApproved++;
      }
    }

    const maxApplies = Math.min(Math.max(settings.maxAppliesPerRun ?? 5, 1), 50);
    const toApply = await db.metaAdsRecommendation.findMany({
      where: {
        accountId: acc,
        status: "approved",
        actionType: { in: EXECUTABLE_ACTIONS },
      },
      orderBy: { createdAt: "asc" },
      take: maxApplies,
      select: { id: true },
    });

    for (const r of toApply) {
      const result = await applyRecommendation(r.id, {
        triggeredBy: "rule_engine",
        forceQueued: false,
      });

      if (result.ok) {
        applied++;
        if (result.outcome === "simulated") simulated++;
      } else {
        if (result.outcome === "blocked") blocked++;
        else if (result.outcome === "failed") failed++;
        else skipped++;
        if (!topError) topError = result.error;
      }
    }

    const summary = {
      generated,
      autoApproved,
      applied,
      simulated,
      blocked,
      failed,
      skipped,
      criticalRecommendationsGenerated,
      trendDataAvailable,
      alertsSent,
      ...(topError && { error: topError }),
    };

    const runStatus =
      failed > 0 ? "partial" : blocked > 0 || applied > 0 ? "success" : generated > 0 ? "success" : "success";

    await db.metaAdsSchedulerRunLog.update({
      where: { id: runLog.id },
      data: {
        finishedAt: new Date(),
        status: runStatus,
        summary,
        ...(topError && { error: topError }),
      },
    });

    await db.metaAdsAutomationSettings.update({
      where: { accountId: acc },
      data: {
        lastSchedulerRunAt: new Date(),
        lastSchedulerRunStatus: runStatus,
        lastSchedulerRunSummary: summary,
        updatedAt: new Date(),
      },
    });

    return {
      status: runStatus,
      summary: {
        generated,
        autoApproved,
        applied,
        simulated,
        blocked,
        failed,
        skipped,
        criticalRecommendationsGenerated,
        trendDataAvailable,
        alertsSent,
        error: topError,
      },
      runLogId: runLog.id,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await sendMetaAdsAlert({
      eventType: "scheduler_failure",
      severity: "critical",
      accountId: acc,
      message: `Scheduler cycle exception: ${errMsg}`,
    });
    await db.metaAdsSchedulerRunLog.update({
      where: { id: runLog.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        error: errMsg,
        summary: { generated, autoApproved, applied, simulated, blocked, failed, skipped, error: errMsg },
      },
    });
    await db.metaAdsAutomationSettings.update({
      where: { accountId: acc },
      data: {
        lastSchedulerRunAt: new Date(),
        lastSchedulerRunStatus: "failed",
        lastSchedulerRunSummary: { error: errMsg },
        updatedAt: new Date(),
      },
    });
    return {
      status: "failed",
      summary: { generated, autoApproved, applied, simulated, blocked, failed, skipped, error: errMsg },
      runLogId: runLog.id,
    };
  }
}
