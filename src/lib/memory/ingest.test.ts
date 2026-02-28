/**
 * Phase 7.1: Memory ingest unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ingestFromNextActionExecution,
  ingestFromNextActionDismiss,
  ingestFromNextActionSnooze,
} from "./ingest";

vi.mock("@/lib/db", () => ({
  db: {
    nextActionExecution: {
      findUnique: vi.fn(),
    },
    nextBestAction: {
      findUnique: vi.fn(),
    },
    operatorMemoryEvent: {
      create: vi.fn().mockResolvedValue({ id: "e1" }),
    },
    operatorLearnedWeight: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "w1" }),
      update: vi.fn().mockResolvedValue({ id: "w1" }),
    },
  },
}));

describe("memory ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ingestFromNextActionExecution creates event and updates weight on success", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextActionExecution.findUnique).mockResolvedValue({
      id: "ex1",
      nextActionId: "n1",
      actionKey: "mark_done",
      status: "success",
      startedAt: new Date(),
      finishedAt: new Date(),
      nextAction: {
        createdByRule: "flywheel_stage_stall",
        templateKey: null,
        dedupeKey: "dk1",
      },
    } as never);
    vi.mocked(db.operatorLearnedWeight.findUnique).mockResolvedValue(null);

    await ingestFromNextActionExecution("ex1", "user1");

    expect(db.operatorMemoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "user1",
          sourceType: "nba_execute",
          ruleKey: "flywheel_stage_stall",
          actionKey: "mark_done",
          outcome: "success",
        }),
      })
    );
    expect(db.operatorLearnedWeight.create).toHaveBeenCalled();
  });

  it("ingestFromNextActionDismiss creates event and applies dismiss weight", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextBestAction.findUnique).mockResolvedValue({
      createdByRule: "overdue_reminders",
      templateKey: null,
      dedupeKey: "dk1",
    } as never);
    vi.mocked(db.operatorLearnedWeight.findUnique).mockResolvedValue(null);

    await ingestFromNextActionDismiss("n1", "user1");

    expect(db.operatorMemoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "user1",
          sourceType: "nba_dismiss",
          ruleKey: "overdue_reminders",
          outcome: "neutral",
        }),
      })
    );
    expect(db.operatorLearnedWeight.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "user1",
          kind: "rule",
          key: "overdue_reminders",
          weight: -0.5,
        }),
      })
    );
  });

  it("ingestFromNextActionSnooze applies snooze weight delta", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.nextBestAction.findUnique).mockResolvedValue({
      createdByRule: "retention_overdue",
      templateKey: null,
      dedupeKey: "dk1",
    } as never);
    vi.mocked(db.operatorLearnedWeight.findUnique).mockResolvedValue(null);

    await ingestFromNextActionSnooze("n1", "user1");

    expect(db.operatorLearnedWeight.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: "retention_overdue",
          weight: -0.25,
        }),
      })
    );
  });
});
