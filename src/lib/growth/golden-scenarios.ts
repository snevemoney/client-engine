/**
 * Phase 6.3.2: Growth golden scenario definitions.
 */
export type GoldenScenario = {
  key: string;
  description: string;
  seed: {
    ownerUserId: string;
    dealOverrides?: { stage?: string; nextFollowUpAt?: Date | null };
    followUpSchedule?: { nextFollowUpAt?: Date; cadenceDays?: number; status?: string };
    outreachEvents?: Array<{ type: string; occurredAt: Date }>;
  };
  expected?: {
    outreachEventCount?: number;
    scheduleCount?: number;
    dealStage?: string;
    nextFollowUpAtSet?: boolean;
  };
};

export const GOLDEN_GROWTH_SCENARIOS: GoldenScenario[] = [
  {
    key: "golden_growth_draft_creates_draft",
    description: "Draft creates OutreachMessage with status draft",
    seed: { ownerUserId: "golden_user" },
    expected: { outreachEventCount: 0 },
  },
  {
    key: "golden_growth_send_creates_event_and_schedule",
    description: "Send creates OutreachEvent.sent + FollowUpSchedule + Deal.nextFollowUpAt",
    seed: { ownerUserId: "golden_user" },
    expected: { outreachEventCount: 1, scheduleCount: 1, dealStage: "contacted", nextFollowUpAtSet: true },
  },
  {
    key: "golden_growth_schedule_followup_updates_schedule_and_deal",
    description: "Schedule followup updates FollowUpSchedule and Deal.nextFollowUpAt",
    seed: {
      ownerUserId: "golden_user",
      followUpSchedule: { nextFollowUpAt: new Date(Date.now() - 86400000), cadenceDays: 3 },
    },
    expected: { scheduleCount: 1, nextFollowUpAtSet: true },
  },
  {
    key: "golden_growth_mark_replied_updates_stage_and_logs_reply",
    description: "Mark replied sets stage=replied and logs OutreachEvent.reply",
    seed: { ownerUserId: "golden_user", dealOverrides: { stage: "contacted" } },
    expected: { dealStage: "replied", outreachEventCount: 1 },
  },
  {
    key: "golden_growth_overdue_followup_produces_growth_nba",
    description: "Overdue schedule triggers growth_overdue_followups NBA",
    seed: {
      ownerUserId: "golden_user",
      dealOverrides: { stage: "contacted" },
      followUpSchedule: {
        nextFollowUpAt: new Date(Date.now() - 86400000 * 2),
        cadenceDays: 3,
        status: "active",
      },
    },
    expected: { scheduleCount: 1 },
  },
];
