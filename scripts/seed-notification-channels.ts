/**
 * Phase 2.8.6: Seed default notification channels (idempotent).
 * Run: npm run db:seed-notification-channels
 */
import { db } from "../src/lib/db";
import { NotificationChannelType } from "@prisma/client";

const CHANNELS = [
  {
    key: "in_app",
    title: "In-App",
    type: NotificationChannelType.in_app,
    isEnabled: true,
    isDefault: true,
  },
  {
    key: "webhook_ops",
    title: "Webhook (Ops)",
    type: NotificationChannelType.webhook,
    isEnabled: false,
    isDefault: false,
    configJson: { url: "", headers: {} },
  },
  {
    key: "email_me",
    title: "Email (Manual)",
    type: NotificationChannelType.email,
    isEnabled: false,
    isDefault: false,
    configJson: { to: "" },
  },
  {
    key: "discord_ops",
    title: "Discord Webhook",
    type: NotificationChannelType.discord_webhook,
    isEnabled: false,
    isDefault: false,
    configJson: { url: "" },
  },
];

async function main() {
  for (const ch of CHANNELS) {
    const existing = await db.notificationChannel.findUnique({ where: { key: ch.key } });
    if (existing) {
      console.log(`Channel ${ch.key} already exists, skipping`);
      continue;
    }
    await db.notificationChannel.create({
      data: {
        key: ch.key,
        title: ch.title,
        type: ch.type,
        isEnabled: ch.isEnabled,
        isDefault: ch.isDefault,
        configJson: (ch as { configJson?: object }).configJson ?? undefined,
      },
    });
    console.log(`Created channel: ${ch.key}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
