/**
 * Phase 2.8.6: In-app notification channel — writes to InAppNotification.
 */

import { db } from "@/lib/db";
import type { ChannelAdapterResult, SendPayload } from "../types";

export async function sendInApp(
  payload: SendPayload,
  config: Record<string, unknown>
): Promise<ChannelAdapterResult> {
  const notificationEventId = config.notificationEventId as string | undefined;
  try {
    await db.inAppNotification.create({
      data: {
        notificationEventId: notificationEventId ?? null,
        title: payload.title,
        message: payload.message,
        severity: payload.severity,
        actionUrl: payload.actionUrl ?? null,
      },
    });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
