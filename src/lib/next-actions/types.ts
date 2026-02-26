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
  /** Optional: affects ranking. Base score from priority + small boost. */
  countBoost?: number;
  recencyBoost?: number;
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
};
