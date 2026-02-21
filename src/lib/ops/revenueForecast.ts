/**
 * Simple revenue forecast from pipeline and win rate.
 * Used by chatbot for PBD-style "what's the cash impact" answers.
 */

import { getMoneyScorecard } from "./moneyScorecard";

export type RevenueForecast = {
  at: string;
  pipelineValueEstimate: number;
  avgDealSize: number | null;
  dealsWonRecent: number;
  dealsLostRecent: number;
  winRatePct: number | null;
  impliedRevenueIfSentConvert: number; // sent * avgDealSize * winRate
};

const DEFAULT_DEAL = 12000;

export async function getRevenueForecast(): Promise<RevenueForecast> {
  const money = await getMoneyScorecard();
  const winRate =
    money.proposalsSent > 0
      ? Math.round((money.dealsWon / money.proposalsSent) * 100)
      : null;
  const avg = money.avgDealSizeEstimate ?? DEFAULT_DEAL;
  const impliedRevenueIfSentConvert =
    money.proposalsSent * avg * ((winRate ?? 20) / 100);

  return {
    at: money.at,
    pipelineValueEstimate: money.pipelineValueEstimate,
    avgDealSize: money.avgDealSizeEstimate,
    dealsWonRecent: money.dealsWon,
    dealsLostRecent: money.dealsLost,
    winRatePct: winRate,
    impliedRevenueIfSentConvert: Math.round(impliedRevenueIfSentConvert),
  };
}
