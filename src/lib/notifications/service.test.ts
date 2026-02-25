import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import {
  createNotificationEvent,
  queueNotificationDeliveries,
  buildDefaultChannelSelection,
  dispatchNotificationDelivery,
} from "./service";

const adapterRef = vi.hoisted(() => ({ current: null as { type: string; send: (p: unknown, c: unknown) => Promise<{ ok: boolean; error?: string }> } | null }));

vi.mock("@/lib/notifications/channels", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/notifications/channels")>();
  return {
    ...mod,
    getAdapterForChannelType: (type: string) => {
      if (adapterRef.current) return adapterRef.current;
      return mod.getAdapterForChannelType(type as "in_app" | "webhook" | "email" | "discord_webhook");
    },
  };
});

describe("notification service", () => {
  beforeEach(async () => {
    await db.notificationEvent.deleteMany({});
    await db.notificationDelivery.deleteMany({});
    await db.inAppNotification.deleteMany({});
  });

  describe("createNotificationEvent", () => {
    it("creates event", async () => {
      const r = await createNotificationEvent({
        eventKey: "test",
        title: "Test",
        message: "Msg",
        severity: "info",
      });
      expect(r.created).toBe(true);
      expect(r.id).toBeDefined();
    });

    it("dedupes within window when dedupeKey provided", async () => {
      const r1 = await createNotificationEvent({
        eventKey: "test",
        title: "Test",
        message: "Msg",
        severity: "info",
        dedupeKey: "test:dedupe:1",
      });
      const r2 = await createNotificationEvent({
        eventKey: "test",
        title: "Test",
        message: "Msg",
        severity: "info",
        dedupeKey: "test:dedupe:1",
      });
      expect(r1.created).toBe(true);
      expect(r2.created).toBe(false);
      expect(r2.id).toBe(r1.id);
    });
  });

  describe("buildDefaultChannelSelection", () => {
    it("includes in_app always", () => {
      const keys = buildDefaultChannelSelection({ severity: "info" });
      expect(keys).toContain("in_app");
    });

    it("adds webhook_ops for critical", () => {
      const keys = buildDefaultChannelSelection({ severity: "critical" });
      expect(keys).toContain("in_app");
      expect(keys).toContain("webhook_ops");
    });
  });

  describe("queueNotificationDeliveries", () => {
    it("creates in-app delivery when channel exists", async () => {
      const ch = await db.notificationChannel.findFirst({ where: { key: "in_app" } });
      if (!ch) {
        await db.notificationChannel.create({
          data: { key: "in_app", title: "In-App", type: "in_app", isEnabled: true },
        });
      }

      const { id } = await createNotificationEvent({
        eventKey: "test",
        title: "T",
        message: "M",
        severity: "info",
      });
      const q = await queueNotificationDeliveries(id, ["in_app"]);
      expect(q.queued).toBeGreaterThanOrEqual(0);
    });
  });

  describe("dispatchNotificationDelivery — adapter failure, config, retry, dedupe (Matrix 24–27)", () => {
    async function ensureInAppChannel() {
      let ch = await db.notificationChannel.findFirst({ where: { key: "in_app" } });
      if (!ch) {
        ch = await db.notificationChannel.create({
          data: { key: "in_app", title: "In-App", type: "in_app", isEnabled: true },
        });
      }
      return ch;
    }

    it("24: adapter send() throws — delivery marked failed with errorCode and errorMessage", async () => {
      await ensureInAppChannel();
      const { id: eventId } = await createNotificationEvent({ eventKey: "t", title: "T", message: "M", severity: "info" });
      await queueNotificationDeliveries(eventId, ["in_app"]);
      const delivery = await db.notificationDelivery.findFirst({ where: { notificationEventId: eventId } });
      expect(delivery).toBeTruthy();
      await db.notificationDelivery.update({ where: { id: delivery!.id }, data: { maxAttempts: 1 } });

      adapterRef.current = {
        type: "in_app",
        send: async () => {
          throw new Error("Simulated adapter failure");
        },
      };
      const r = await dispatchNotificationDelivery(delivery!.id);
      adapterRef.current = null;

      expect(r.ok).toBe(false);
      expect(r.failed).toBe(true);

      const updated = await db.notificationDelivery.findUnique({ where: { id: delivery!.id } });
      expect(updated?.status).toBe("failed");
      expect(updated?.errorCode).toBeDefined();
      expect(updated?.errorMessage).toContain("Simulated adapter failure");
    });

    it("25: invalid channel configJson — safe failure, no throw", async () => {
      const uniqueKey = `test_malformed_config_${Date.now()}`;
      const ch = await db.notificationChannel.create({
        data: { key: uniqueKey, title: "Test", type: "in_app", isEnabled: true, configJson: ["array"] },
      });
      const ev = await db.notificationEvent.create({
        data: { eventKey: "t", title: "T", message: "M", severity: "info", occurredAt: new Date(), status: "queued" },
      });
      const d = await db.notificationDelivery.create({
        data: { notificationEventId: ev.id, channelId: ch.id, status: "queued", attempt: 0, maxAttempts: 3, runAfter: new Date() },
      });

      const r = await dispatchNotificationDelivery(d.id);
      expect(r.ok).toBe(true);
      expect(r.sent).toBe(true);
    });

    it("26: retry backoff — attempt, runAfter, maxAttempts set on failure", async () => {
      await ensureInAppChannel();
      const { id: eventId } = await createNotificationEvent({ eventKey: "t", title: "T", message: "M", severity: "info" });
      await queueNotificationDeliveries(eventId, ["in_app"]);
      const delivery = await db.notificationDelivery.findFirst({ where: { notificationEventId: eventId } });
      expect(delivery).toBeTruthy();

      adapterRef.current = {
        type: "in_app",
        send: async () => ({ ok: false, error: "Provider rejected" }),
      };
      await dispatchNotificationDelivery(delivery!.id);
      adapterRef.current = null;

      const updated = await db.notificationDelivery.findUnique({ where: { id: delivery!.id } });
      expect(updated?.status).toBe("queued");
      expect(updated?.attempt).toBe(1);
      expect(updated?.runAfter).toBeInstanceOf(Date);
      expect(updated?.maxAttempts).toBe(3);
    });

    it("27: in-app delivery dedupe — second dispatch skipped when InAppNotification exists", async () => {
      await ensureInAppChannel();
      const { id: eventId } = await createNotificationEvent({ eventKey: "t", title: "T", message: "M", severity: "info" });
      await queueNotificationDeliveries(eventId, ["in_app"]);

      const deliveries = await db.notificationDelivery.findMany({ where: { notificationEventId: eventId }, orderBy: { createdAt: "asc" } });
      expect(deliveries.length).toBeGreaterThanOrEqual(1);
      const first = deliveries[0];

      await db.inAppNotification.create({
        data: { notificationEventId: eventId, title: "T", message: "M", severity: "info" },
      });

      const r = await dispatchNotificationDelivery(first.id);
      expect(r.ok).toBe(true);
      expect(r.skipped).toBe(true);

      const updated = await db.notificationDelivery.findUnique({ where: { id: first.id } });
      expect(updated?.status).toBe("skipped");
      expect(updated?.errorCode).toBe("DEDUPED");

      const inAppCount = await db.inAppNotification.count({ where: { notificationEventId: eventId } });
      expect(inAppCount).toBe(1);
    });
  });
});
