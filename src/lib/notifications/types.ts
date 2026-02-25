/**
 * Phase 2.8.6: Notification types.
 */

import type { NotificationSeverity } from "@prisma/client";

export type Severity = NotificationSeverity;

export type CreateNotificationEventInput = {
  eventKey: string;
  title: string;
  message: string;
  severity: Severity;
  sourceType?: string | null;
  sourceId?: string | null;
  actionUrl?: string | null;
  metaJson?: Record<string, unknown> | null;
  dedupeKey?: string | null;
  createdByRule?: string | null;
};

export type ChannelAdapterResult = {
  ok: boolean;
  providerMessageId?: string | null;
  response?: unknown;
  error?: string | null;
};

export type ChannelAdapter = {
  type: string;
  send: (payload: SendPayload, config: Record<string, unknown>) => Promise<ChannelAdapterResult>;
};

export type SendPayload = {
  eventKey: string;
  title: string;
  message: string;
  severity: Severity;
  sourceType?: string | null;
  sourceId?: string | null;
  actionUrl?: string | null;
  meta?: Record<string, unknown> | null;
  occurredAt: string;
};
