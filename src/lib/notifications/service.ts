/**
 * Phase 2.8.6: Notification service — create events, queue deliveries, dispatch.
 */

import { db } from "@/lib/db";
import {
  NotificationEventStatus,
  NotificationDeliveryStatus,
  NotificationSeverity,
} from "@prisma/client";
import { sanitizeNotificationMeta } from "./sanitize";
import type { CreateNotificationEventInput } from "./types";
import { getAdapterForChannelType } from "./channels";
import { logOpsEventSafe } from "@/lib/ops-events/log";

const DELIVERY_DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 min

const SEVERITY_ORDER: Record<NotificationSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

function meetsSeverityMin(eventSeverity: NotificationSeverity, channelMin?: NotificationSeverity | null): boolean {
  if (!channelMin) return true;
  return SEVERITY_ORDER[eventSeverity] >= SEVERITY_ORDER[channelMin];
}

/**
 * Create a notification event. Idempotent if dedupeKey provided and event exists within window.
 */
export async function createNotificationEvent(input: CreateNotificationEventInput): Promise<{
  id: string;
  created: boolean;
}> {
  const now = new Date();
  const metaJson = input.metaJson != null ? sanitizeNotificationMeta(input.metaJson) : null;

  if (input.dedupeKey) {
    const existing = await db.notificationEvent.findFirst({
      where: { dedupeKey: input.dedupeKey },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      const ageMs = now.getTime() - existing.createdAt.getTime();
      if (ageMs < 60 * 60 * 1000) {
        return { id: existing.id, created: false };
      }
    }
  }

  const event = await db.notificationEvent.create({
    data: {
      eventKey: input.eventKey,
      title: input.title,
      message: input.message,
      severity: input.severity,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      actionUrl: input.actionUrl ?? null,
      metaJson: metaJson ?? undefined,
      dedupeKey: input.dedupeKey ?? null,
      status: NotificationEventStatus.pending,
      occurredAt: now,
      createdByRule: input.createdByRule ?? null,
    },
  });

  return { id: event.id, created: true };
}

/**
 * Build default channel selection: in_app always, webhook for critical if enabled.
 */
export function buildDefaultChannelSelection(event: {
  severity: NotificationSeverity;
  eventKey?: string;
}): string[] {
  const keys: string[] = ["in_app"];
  if (event.severity === "critical") {
    keys.push("webhook_ops");
  }
  return keys;
}

/**
 * Queue notification deliveries for an event. Creates delivery records per channel.
 */
export async function queueNotificationDeliveries(
  eventId: string,
  channelKeys?: string[] | null
): Promise<{ queued: number }> {
  const event = await db.notificationEvent.findUnique({
    where: { id: eventId },
    include: { deliveries: true },
  });
  if (!event) throw new Error("Notification event not found");

  const keys = channelKeys ?? buildDefaultChannelSelection(event);
  const channels = await db.notificationChannel.findMany({
    where: { key: { in: keys }, isEnabled: true },
  });

  let queued = 0;
  const now = new Date();

  for (const ch of channels) {
    if (!meetsSeverityMin(event.severity, ch.severityMin)) continue;
    const existing = event.deliveries.some((d) => d.channelId === ch.id);
    if (existing) continue;

    const windowBucket = Math.floor(now.getTime() / DELIVERY_DEDUPE_WINDOW_MS);
    const dedupeKey = `delivery:${eventId}:${ch.id}:${windowBucket}`;

    await db.notificationDelivery.create({
      data: {
        notificationEventId: eventId,
        channelId: ch.id,
        status: NotificationDeliveryStatus.queued,
        attempt: 0,
        maxAttempts: 3,
        runAfter: now,
        dedupeKey,
      },
    });
    queued++;
  }

  if (queued > 0) {
    await db.notificationEvent.update({
      where: { id: eventId },
      data: { status: NotificationEventStatus.queued, queuedAt: now },
    });
  }

  return { queued };
}

/**
 * Dispatch a single delivery via its adapter.
 */
export async function dispatchNotificationDelivery(deliveryId: string): Promise<{
  ok: boolean;
  sent?: boolean;
  failed?: boolean;
  skipped?: boolean;
}> {
  const delivery = await db.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: { notificationEvent: true, channel: true },
  });
  if (!delivery) throw new Error("Delivery not found");
  if (delivery.status !== NotificationDeliveryStatus.queued && delivery.status !== NotificationDeliveryStatus.failed) {
    return { ok: true, skipped: true };
  }
  if (delivery.attempt >= delivery.maxAttempts) {
    return { ok: true, skipped: true };
  }

  const runAfter = delivery.runAfter;
  if (runAfter && runAfter > new Date()) {
    return { ok: true, skipped: true };
  }

  const ev = delivery.notificationEvent;
  const ch = delivery.channel;

  // Delivery dedupe: in_app — skip if InAppNotification already exists for this event
  if (ch.type === "in_app") {
    const existing = await db.inAppNotification.findFirst({
      where: { notificationEventId: ev.id },
    });
    if (existing) {
      logOpsEventSafe({
        category: "system",
        eventKey: "notification.delivery.deduped",
        sourceType: "delivery",
        sourceId: deliveryId,
        meta: { eventId: ev.id, channelKey: ch.key },
      });
      await db.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: NotificationDeliveryStatus.skipped,
          errorCode: "DEDUPED",
          errorMessage: "In-app notification already exists for this event",
        },
      });
      return { ok: true, skipped: true };
    }
  }

  const adapter = getAdapterForChannelType(ch.type);
  if (!adapter) {
    await db.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.skipped,
        failedAt: new Date(),
        errorCode: "NO_ADAPTER",
        errorMessage: `No adapter for channel type: ${ch.type}`,
      },
    });
    return { ok: true, skipped: true };
  }

  let config: Record<string, unknown>;
  try {
    config = (ch.configJson != null && typeof ch.configJson === "object" && !Array.isArray(ch.configJson)
      ? ch.configJson
      : {}) as Record<string, unknown>;
  } catch {
    config = {};
  }
  if (ch.type === "in_app") {
    config.notificationEventId = ev.id;
  }

  const payload = {
    eventKey: ev.eventKey,
    title: ev.title,
    message: ev.message,
    severity: ev.severity,
    sourceType: ev.sourceType ?? null,
    sourceId: ev.sourceId ?? null,
    actionUrl: ev.actionUrl ?? null,
    meta: (ev.metaJson != null && typeof ev.metaJson === "object" && !Array.isArray(ev.metaJson)
      ? ev.metaJson
      : null) as Record<string, unknown> | null,
    occurredAt: ev.occurredAt.toISOString(),
  };

  await db.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: NotificationDeliveryStatus.sending,
      attempt: delivery.attempt + 1,
    },
  });

  let result: { ok: boolean; providerMessageId?: string | null; response?: unknown; error?: string | null };
  try {
    result = await adapter.send(payload, config);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logOpsEventSafe({
      category: "system",
      level: "error",
      eventKey: "notification.delivery.adapter_error",
      sourceType: "delivery",
      sourceId: deliveryId,
      errorCode: err instanceof Error ? err.name : "AdapterError",
      errorMessage: msg.slice(0, 500),
      meta: { channelType: ch.type },
    });
    result = { ok: false, error: msg };
  }
  const now = new Date();

  if (result.ok) {
    await db.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: NotificationDeliveryStatus.sent,
        sentAt: now,
        providerMessageId: result.providerMessageId ?? null,
        responsePayloadJson: result.response != null ? sanitizeNotificationMeta(result.response as Record<string, unknown>) ?? undefined : undefined,
      },
    });

    const allDeliveries = await db.notificationDelivery.findMany({
      where: { notificationEventId: ev.id },
    });
    const allSent = allDeliveries.every(
      (d) => d.id === deliveryId || d.status === NotificationDeliveryStatus.sent || d.status === NotificationDeliveryStatus.skipped
    );
    const anyFailed = allDeliveries.some((d) => d.status === NotificationDeliveryStatus.failed);
    if (allSent && !anyFailed) {
      await db.notificationEvent.update({
        where: { id: ev.id },
        data: { status: NotificationEventStatus.sent, sentAt: now },
      });
    }

    return { ok: true, sent: true };
  }

  const backoffMinutes = [1, 5, 15][delivery.attempt] ?? 15;
  const runAfterNext = new Date(now.getTime() + backoffMinutes * 60 * 1000);
  const willRetry = delivery.attempt + 1 < delivery.maxAttempts;

  const errorCode = result.error?.startsWith("HTTP ") ? "HTTP_ERROR" : "SEND_FAILED";
  await db.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: willRetry ? NotificationDeliveryStatus.queued : NotificationDeliveryStatus.failed,
      failedAt: now,
      errorCode,
      errorMessage: (result.error ?? "Unknown error").slice(0, 1000),
      requestPayloadJson: sanitizeNotificationMeta(payload) ?? undefined,
      responsePayloadJson: result.response != null ? (sanitizeNotificationMeta(result.response as Record<string, unknown>) ?? undefined) : undefined,
      runAfter: willRetry ? runAfterNext : null,
    },
  });

  if (!willRetry) {
    await db.notificationEvent.update({
      where: { id: ev.id },
      data: { status: NotificationEventStatus.failed, failedAt: now, errorMessage: result.error ?? null },
    });
  }

  return { ok: false, failed: true };
}

/**
 * Dispatch pending deliveries (queued or retryable). Returns counts.
 */
export async function dispatchPendingDeliveries(limit = 20): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date();
  const pending = await db.notificationDelivery.findMany({
    where: {
      status: { in: [NotificationDeliveryStatus.queued, NotificationDeliveryStatus.failed] },
      OR: [{ runAfter: null }, { runAfter: { lte: now } }],
    },
    orderBy: { runAfter: "asc" },
    take: limit,
    include: { notificationEvent: true, channel: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const d of pending) {
    const r = await dispatchNotificationDelivery(d.id);
    if (r.sent) sent++;
    else if (r.failed) failed++;
    else if (r.skipped) skipped++;
  }

  return { sent, failed, skipped };
}

/**
 * Retry a failed delivery.
 */
export async function retryFailedDelivery(deliveryId: string): Promise<{ ok: boolean }> {
  const delivery = await db.notificationDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new Error("Delivery not found");
  if (delivery.status !== NotificationDeliveryStatus.failed) {
    return { ok: true };
  }

  await db.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: NotificationDeliveryStatus.queued,
      runAfter: new Date(),
      failedAt: null,
      errorMessage: null,
    },
  });

  await dispatchNotificationDelivery(deliveryId);
  return { ok: true };
}

/**
 * Mark an in-app notification as read.
 */
export async function markRead(inAppNotificationId: string): Promise<{ ok: boolean }> {
  const now = new Date();
  await db.inAppNotification.updateMany({
    where: { id: inAppNotificationId },
    data: { isRead: true, readAt: now },
  });
  return { ok: true };
}

/**
 * Mark all in-app notifications as read.
 */
export async function markAllRead(): Promise<{ count: number }> {
  const result = await db.inAppNotification.updateMany({
    where: { isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { count: result.count };
}
