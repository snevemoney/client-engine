/**
 * Phase 4.0: Next Best Action types.
 */

import type { NextActionPriority, RiskSourceType } from "@prisma/client";

export type NextActionCandidate = {
  title: string;
  reason?: string | null;
  priority: NextActionPriority;
  score: number; // 0-100 ranking
  sourceType: RiskSourceType;
  sourceId?: string | null;
  actionUrl?: string | null;
  payloadJson?: Record<string, unknown> | null;
  createdByRule: string;
  dedupeKey: string;
  /** Phase 4.1: scope */
  entityType?: string;
  entityId?: string;
  /** Phase 4.1: structured explanation */
  explanationJson?: Record<string, unknown> | null;
  /** Optional: affects ranking */
  countBoost?: number;
  recencyBoost?: number;
  urgencyBoost?: number;
  impactBoost?: number;
  frictionPenalty?: number;
  /** Revenue attribution: dollar value at stake for this action */
  revenueAtStake?: number;
  revenueCurrency?: string;
  revenueLabel?: string;
};

export type NextActionContext = {
  now: Date;
  /** Command center score band */
  commandCenterBand: string | null;
  /** Failed delivery count 24h */
  failedDeliveryCount: number;
  /** Overdue reminders (high+) count */
  overdueRemindersCount: number;
  /** Proposals sentNoFollowupDate count */
  sentNoFollowupDateCount: number;
  /** Retention overdue count */
  retentionOverdueCount: number;
  /** Handoff done, no client confirm count */
  handoffNoClientConfirmCount: number;
  /** Won deals with no delivery project (3d+) */
  wonNoDeliveryCount: number;
  /** Won deals with no referral asked (7d+) */
  referralGapCount: number;
  /** Active leads with no contact for 10d+ */
  stageStallCount: number;
  /** Phase 6.3: Growth pipeline (when ownerUserId provided) */
  growthOverdueCount?: number;
  growthNoOutreachCount?: number;
  growthDealCount?: number;
  growthLastActivityAt?: Date | null;
  /** Phase 6.3.1: First deal IDs for delivery actions */
  growthFirstOverdueDealId?: string | null;
  growthFirstNoOutreachDealId?: string | null;
  /** Builder content quality: count of projects with health score < 70 */
  builderPoorQualityCount: number;
  /** First project ID with poor quality (for actionUrl) */
  builderPoorQualityProjectId?: string | null;
  /** Proposals with overdue follow-ups */
  proposalOverdueFollowupCount: number;
  /** Phase 9.2: Interactions (48h) with no next action scheduled */
  interactionsWithoutNextActionCount: number;
  /** Phase 9.2: Active clients with no interaction in 7+ days */
  clientInteractionGapCount: number;
};
