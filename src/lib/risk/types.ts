/**
 * Phase 4.0: Risk flags types.
 */

import type { RiskSeverity, RiskSourceType } from "@prisma/client";

export type RiskRuleResult = {
  key: string;
  title: string;
  description?: string | null;
  severity: RiskSeverity;
  sourceType: RiskSourceType;
  sourceId?: string | null;
  actionUrl?: string | null;
  suggestedFix?: string | null;
  evidenceJson?: Record<string, unknown> | null;
  createdByRule: string;
  /** Revenue exposed by this risk (dollars, when computable) */
  exposedRevenue?: number;
  exposedRevenueCurrency?: string;
};

export type RiskCandidate = RiskRuleResult & { dedupeKey: string };

export type RiskRuleContext = {
  now: Date;
  /** Failed NotificationDelivery count in last 24h */
  failedDeliveryCount24h: number;
  /** Stale running JobRun count */
  staleRunningJobsCount: number;
  /** Overdue OpsReminder count (priority high+) */
  overdueRemindersHighCount: number;
  /** Command center score band (healthy | warning | critical) */
  commandCenterBand: string | null;
  /** Proposal follow-up overdue count */
  proposalFollowupOverdueCount: number;
  /** Retention overdue count */
  retentionOverdueCount: number;
  /** Phase 6.3: Growth pipeline (when ownerUserId provided) */
  ownerUserId?: string;
  growthDealCount?: number;
  growthLastActivityAt?: Date | null;
  /** Phase 9.2: Clients with active proposal/delivery and 14+ days silence */
  criticalInteractionGapCount: number;
};
