/**
 * Phase 2.8.6: Channel adapters registry.
 */

import { NotificationChannelType } from "@prisma/client";
import { sendInApp } from "./in-app";
import { sendWebhook } from "./webhook";
import { sendEmail } from "./email";
import type { ChannelAdapter } from "../types";

export const channelAdapters: Record<string, ChannelAdapter> = {
  in_app: {
    type: "in_app",
    send: async (payload, config) => sendInApp(payload, config),
  },
  webhook: {
    type: "webhook",
    send: async (payload, config) => sendWebhook(payload, config),
  },
  discord_webhook: {
    type: "webhook",
    send: async (payload, config) => sendWebhook(payload, config),
  },
  email: {
    type: "email",
    send: async (payload, config) => sendEmail(payload, config),
  },
};

export function getAdapterForChannelType(channelType: NotificationChannelType): ChannelAdapter | null {
  if (channelType === "in_app") return channelAdapters.in_app;
  if (channelType === "webhook" || channelType === "discord_webhook") return channelAdapters.webhook;
  if (channelType === "email") return channelAdapters.email;
  return null;
}
