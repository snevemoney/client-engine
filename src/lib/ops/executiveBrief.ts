/**
 * End-of-day executive brief: throughput, what broke, constraint, money opportunity, top actions, risk, best lead.
 * Used by chatbot for "come back from 9-5" battlefield report.
 */

import { buildBrief } from "@/lib/orchestrator/brief";
import { getConstraintSnapshot } from "./constraint";
import { getConstraintPlaybook } from "./constraintPlaybook";
import { getMoneyScorecard } from "./moneyScorecard";
import { getPipelineLeakReport } from "./pipelineLeak";
import { getTopLeadsBySignal } from "./topLeads";
import { getRevenueForecast } from "./revenueForecast";
import { getStageConversion } from "./stageConversion";
import { db } from "@/lib/db";

export type ExecutiveBriefContext = {
  todaysThroughput: string;
  whatBroke: string[];
  whatGotFixed: string[];
  primaryConstraint: string;
  constraintPlaybook: string | null;
  moneyOpportunityMissed: string | null;
  top3ActionsTomorrow: string[];
  biggestRisk: string;
  bestLeadToPrioritize: string | null;
  moneyScorecard: string;
  stageConversion: string;
  pipelineLeak: string;
  revenueForecast: string;
};

export async function getExecutiveBriefContext(): Promise<ExecutiveBriefContext> {
  const [brief, constraint, money, conversion, leak, topLeads, forecast] = await Promise.all([
    buildBrief(),
    getConstraintSnapshot(),
    getMoneyScorecard(),
    getStageConversion(),
    getPipelineLeakReport(),
    getTopLeadsBySignal(),
    getRevenueForecast(),
  ]);

  const playbook = getConstraintPlaybook(constraint);

  const recentErrors = await db.pipelineRun.findMany({
    where: { success: false },
    orderBy: { lastErrorAt: "desc" },
    take: 5,
    select: { leadId: true, lastErrorCode: true },
  });

  const todaysThroughput =
    `Leads: ${brief.qualifiedLeads.length} qualified, ${brief.readyProposals.length} proposals ready, ${brief.nextActions.length} next actions. ` +
    `Money: ${money.dealsWon} won, ${money.dealsLost} lost, pipeline est. $${money.pipelineValueEstimate}.`;

  const whatBroke = recentErrors.map((r) => `Pipeline failed (lead ${r.leadId}: ${r.lastErrorCode ?? "error"})`);
  const whatGotFixed: string[] = []; // we don't track "fixed" explicitly; could add from feedback notes
  const primaryConstraint = constraint
    ? `${constraint.label}: ${constraint.reason}`
    : "No single constraint identified.";
  const constraintPlaybook = playbook
    ? `Playbook: ${playbook.actions.join(" ")} ROI focus: ${playbook.roiFocus}`
    : null;

  const moneyOpportunityMissed =
    leak.worstDropOffPct > 50
      ? `Biggest leak: ${leak.worstDropOffStage} (${100 - leak.worstDropOffPct}% conversion). Fixing this could recover pipeline value.`
      : null;

  const top3ActionsTomorrow = brief.nextActions.slice(0, 3).map((a) => `${a.action}: ${a.title}`);
  if (top3ActionsTomorrow.length < 3 && constraint?.recommendedActions.length)
    top3ActionsTomorrow.push(...constraint.recommendedActions.slice(0, 3 - top3ActionsTomorrow.length));

  const biggestRisk =
    recentErrors.length > 0
      ? `${recentErrors.length} failed pipeline run(s); retry or fix step.`
      : brief.risks.length > 0
        ? brief.risks[0]!
        : "No major risk flagged.";

  const bestLeadToPrioritize =
    topLeads.length > 0 && (topLeads[0]!.score ?? 0) >= 6
      ? `${topLeads[0]!.title} (score ${topLeads[0]!.score})`
      : null;

  const moneyScorecard =
    `Money scorecard: discovered ${money.leadsDiscovered}, qualified ${money.leadsQualified}, proposals drafted ${money.proposalsDrafted}, sent ${money.proposalsSent}, won ${money.dealsWon}, lost ${money.dealsLost}. ` +
    `Pipeline value est. $${money.pipelineValueEstimate}. Avg deal ${money.avgDealSizeEstimate ?? "—"}. Time to proposal ${money.timeToProposalMedianDays ?? "—"} days, to close ${money.timeToCloseMedianDays ?? "—"} days.`;

  const stageConversion =
    `Conversion: lead→qualified ${conversion.leadToQualifiedPct}%, qualified→proposal ${conversion.qualifiedToProposalPct}%, proposal→sent ${conversion.proposalToSentPct}%, sent→won ${conversion.sentToWonPct}%, sent→lost ${conversion.sentToLostPct}%, approval→build ${conversion.approvalToBuildPct}%.`;

  const pipelineLeak =
    `Leak: worst drop-off at ${leak.worstDropOffStage} (${leak.worstDropOffPct}% lost). ` +
    leak.leaks.map((l) => `${l.fromStage}→${l.toStage}: ${l.pct}%`).join("; ");

  const revenueForecast =
    `Revenue: pipeline est. $${forecast.pipelineValueEstimate}, win rate ${forecast.winRatePct ?? "—"}%, ` +
    `implied revenue if sent convert $${forecast.impliedRevenueIfSentConvert}.`;

  return {
    todaysThroughput,
    whatBroke,
    whatGotFixed,
    primaryConstraint,
    constraintPlaybook,
    moneyOpportunityMissed,
    top3ActionsTomorrow,
    biggestRisk,
    bestLeadToPrioritize,
    moneyScorecard,
    stageConversion,
    pipelineLeak,
    revenueForecast,
  };
}
